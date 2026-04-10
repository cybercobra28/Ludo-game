"""
Ludo Online — Flask + SocketIO Backend
Deploy on Railway. Frontend on Netlify.
"""
import os, random, string
from datetime import datetime
from flask import Flask, request, jsonify, session
from flask_socketio import SocketIO, join_room, leave_room, emit
from flask_login import LoginManager, login_user, logout_user, current_user, login_required
from flask_cors import CORS

from config import Config
from models import db, bcrypt, User, Room, GameState, Move, ChatMessage
from ludo import LudoGame, COLOR_ORDER

# ── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
bcrypt.init_app(app)

# CORS: allow Netlify frontend
CORS(app, origins=app.config['CORS_ORIGINS'],
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'OPTIONS'])

login_manager = LoginManager(app)

socketio = SocketIO(
    app,
    async_mode='eventlet',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False,
)

# ── In-Memory Store ───────────────────────────────────────────────────────────
active_games: dict = {}
room_players: dict = {}

# ── Helpers ───────────────────────────────────────────────────────────────────
@login_manager.user_loader
def load_user(uid): return User.query.get(int(uid))

def gen_room_id():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def get_room_players(rid): return room_players.get(rid, [])

def assign_color(rid):
    taken = [p['color'] for p in get_room_players(rid)]
    for c in COLOR_ORDER:
        if c not in taken: return c
    return None

def save_game_state(game: LudoGame):
    for color, positions in game.tokens.items():
        gs = GameState.query.filter_by(room_id=game.room_id, color=color).first()
        if gs: gs.token_positions = positions
    room = Room.query.get(game.room_id)
    if room: room.current_turn = game.current_player
    try: db.session.commit()
    except: db.session.rollback()

# ── REST API ──────────────────────────────────────────────────────────────────

@app.route('/api/health')
def health(): return jsonify({'status': 'ok', 'time': datetime.utcnow().isoformat()})

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password', '')
    if not username or len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if not username.isalnum():
        return jsonify({'error': 'Username must be alphanumeric'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    login_user(user, remember=True)
    return jsonify({'success': True, 'user': user.to_dict()})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password', '')
    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401
    login_user(user, remember=True)
    return jsonify({'success': True, 'user': user.to_dict()})

@app.route('/api/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({'success': True})

@app.route('/api/me')
def me():
    if current_user.is_authenticated:
        return jsonify({'user': current_user.to_dict()})
    return jsonify({'user': None})

@app.route('/api/rooms/create', methods=['POST'])
def create_room():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Login required'}), 401
    room_id = gen_room_id()
    while Room.query.get(room_id): room_id = gen_room_id()
    room = Room(room_id=room_id, created_by=current_user.username, status='waiting')
    db.session.add(room)
    db.session.commit()
    return jsonify({'room_id': room_id})

@app.route('/api/rooms/open')
def open_rooms():
    rooms = []
    for r in Room.query.filter_by(status='waiting').all():
        cnt = len(get_room_players(r.room_id))
        if cnt < 4:
            rooms.append({'room_id': r.room_id, 'created_by': r.created_by, 'players': cnt})
    return jsonify(rooms)

@app.route('/api/leaderboard')
def leaderboard():
    players = User.query.order_by(User.wins.desc()).limit(20).all()
    return jsonify([p.to_dict() for p in players])

@app.route('/api/room/<room_id>/history')
def room_history(room_id):
    moves = Move.query.filter_by(room_id=room_id).order_by(Move.created_at.desc()).limit(50).all()
    return jsonify([m.to_dict() for m in moves])

# ── SocketIO Events ───────────────────────────────────────────────────────────

@socketio.on('connect')
def on_connect():
    if not current_user.is_authenticated: return False

@socketio.on('join_game')
def on_join_game(data):
    room_id  = data.get('room_id')
    username = current_user.username
    room = Room.query.get(room_id)
    if not room:
        emit('error', {'message': 'Room not found'}); return

    existing = next((p for p in get_room_players(room_id) if p['username'] == username), None)
    if not existing:
        if len(get_room_players(room_id)) >= 4:
            emit('error', {'message': 'Room is full'}); return
        if room.status == 'playing':
            emit('error', {'message': 'Game already started'}); return
        color = assign_color(room_id)
        if not color:
            emit('error', {'message': 'No colors available'}); return
        player_info = {'username': username, 'color': color, 'sid': request.sid}
        room_players.setdefault(room_id, []).append(player_info)
        gs = GameState(room_id=room_id, player=username, color=color)
        db.session.add(gs)
        try: db.session.commit()
        except: db.session.rollback()
    else:
        existing['sid'] = request.sid
        color = existing['color']

    join_room(room_id)
    players = get_room_players(room_id)

    emit('joined', {'username': username, 'color': color, 'room_id': room_id,
                    'players': [{'username': p['username'], 'color': p['color']} for p in players]})
    emit('player_joined', {'username': username, 'color': color,
                           'players': [{'username': p['username'], 'color': p['color']} for p in players],
                           'count': len(players)}, to=room_id)

    game = active_games.get(room_id)
    if game: emit('game_state', game.get_state())

    if len(players) >= 2 and room.status == 'waiting':
        _start_game(room_id)

def _start_game(room_id):
    room = Room.query.get(room_id)
    if not room or room.status == 'playing': return
    players_info = [{'username': p['username'], 'color': p['color']} for p in get_room_players(room_id)]
    game = LudoGame(room_id, players_info)
    active_games[room_id] = game
    room.status = 'playing'
    room.current_turn = game.current_player
    try: db.session.commit()
    except: db.session.rollback()
    socketio.emit('game_started', {'players': players_info, 'current_turn': game.current_player,
                                   'current_color': game.current_color, 'state': game.get_state()}, to=room_id)

@socketio.on('roll_dice')
def on_roll_dice(data):
    room_id  = data.get('room_id')
    username = current_user.username
    game = active_games.get(room_id)
    if not game: emit('error', {'message': 'Game not found'}); return
    result = game.roll(username)
    if 'error' in result: emit('error', result); return
    try:
        mv = Move(room_id=room_id, player=username, dice_value=result['dice'], move_type='roll')
        db.session.add(mv); db.session.commit()
    except: db.session.rollback()
    emit('dice_result', result, to=room_id)
    if result.get('auto_pass'):
        emit('player_turn', {'current_player': game.current_player, 'current_color': game.current_color}, to=room_id)

@socketio.on('move_token')
def on_move_token(data):
    room_id     = data.get('room_id')
    token_index = data.get('token_index')
    username    = current_user.username
    game = active_games.get(room_id)
    if not game: emit('error', {'message': 'Game not found'}); return
    result = game.move_token(username, token_index)
    if 'error' in result: emit('error', result); return
    try:
        save_game_state(game)
        mv = Move(room_id=room_id, player=username, dice_value=result['dice'],
                  token_index=token_index, to_position=result['new_pos'], move_type='move')
        db.session.add(mv); db.session.commit()
    except: db.session.rollback()
    emit('update_board', result, to=room_id)
    if result.get('game_over'):
        winner_color    = result['winners'][0] if result['winners'] else None
        winner_username = game.color_to_username.get(winner_color)
        try:
            if winner_username:
                w = User.query.filter_by(username=winner_username).first()
                if w: w.wins += 1
            room = Room.query.get(room_id)
            if room: room.status = 'finished'
            for p in get_room_players(room_id):
                u = User.query.filter_by(username=p['username']).first()
                if u: u.games_played += 1
            db.session.commit()
        except: db.session.rollback()
        emit('game_over', {'winner': winner_username, 'winner_color': winner_color,
                           'winners': result['winners']}, to=room_id)
        active_games.pop(room_id, None)
    else:
        emit('player_turn', {'current_player': game.current_player,
                             'current_color': game.current_color,
                             'extra_turn': result.get('extra_turn', False)}, to=room_id)

@socketio.on('send_chat')
def on_chat(data):
    room_id  = data.get('room_id')
    message  = (data.get('message') or '').strip()
    username = current_user.username
    if not message or len(message) > 200: return
    try:
        chat = ChatMessage(room_id=room_id, username=username, message=message)
        db.session.add(chat); db.session.commit()
    except: db.session.rollback()
    emit('chat_message', {'username': username, 'message': message,
                          'time': datetime.utcnow().strftime('%H:%M')}, to=room_id)

@socketio.on('leave_game')
def on_leave_game(data):
    room_id  = data.get('room_id')
    username = current_user.username
    if room_id in room_players:
        room_players[room_id] = [p for p in room_players[room_id] if p['username'] != username]
    leave_room(room_id)
    emit('player_left', {'username': username,
                         'players': [{'username': p['username'], 'color': p['color']}
                                     for p in get_room_players(room_id)]}, to=room_id)

@socketio.on('disconnect')
def on_disconnect():
    username = current_user.username if current_user.is_authenticated else None
    if username:
        for rid, players in room_players.items():
            if any(p['username'] == username for p in players):
                emit('player_disconnected', {'username': username}, to=rid)
                break

# ── Startup ───────────────────────────────────────────────────────────────────
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
