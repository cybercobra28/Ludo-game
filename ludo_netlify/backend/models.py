from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()
bcrypt = Bcrypt()


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id           = db.Column(db.Integer, primary_key=True)
    username     = db.Column(db.String(50), unique=True, nullable=False)
    password     = db.Column(db.String(255), nullable=False)
    wins         = db.Column(db.Integer, default=0)
    games_played = db.Column(db.Integer, default=0)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, raw): self.password = bcrypt.generate_password_hash(raw).decode('utf-8')
    def check_password(self, raw): return bcrypt.check_password_hash(self.password, raw)

    @property
    def win_rate(self):
        return round((self.wins / self.games_played) * 100, 1) if self.games_played else 0.0

    def to_dict(self):
        return {'id': self.id, 'username': self.username,
                'wins': self.wins, 'games_played': self.games_played, 'win_rate': self.win_rate}


class Room(db.Model):
    __tablename__ = 'rooms'
    room_id     = db.Column(db.String(8), primary_key=True)
    status      = db.Column(db.Enum('waiting', 'playing', 'finished'), default='waiting')
    current_turn= db.Column(db.String(50))
    created_by  = db.Column(db.String(50))
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    game_states = db.relationship('GameState', backref='room', lazy=True, cascade='all, delete-orphan')


class GameState(db.Model):
    __tablename__ = 'game_state'
    id              = db.Column(db.Integer, primary_key=True)
    room_id         = db.Column(db.String(8), db.ForeignKey('rooms.room_id', ondelete='CASCADE'))
    player          = db.Column(db.String(50))
    color           = db.Column(db.String(10))
    token_positions = db.Column(db.JSON, default=lambda: [-1,-1,-1,-1])
    is_winner       = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {'player': self.player, 'color': self.color,
                'token_positions': self.token_positions, 'is_winner': self.is_winner}


class Move(db.Model):
    __tablename__ = 'moves'
    id           = db.Column(db.Integer, primary_key=True)
    room_id      = db.Column(db.String(8), db.ForeignKey('rooms.room_id', ondelete='CASCADE'))
    player       = db.Column(db.String(50))
    dice_value   = db.Column(db.Integer)
    token_index  = db.Column(db.Integer)
    from_position= db.Column(db.Integer)
    to_position  = db.Column(db.Integer)
    move_type    = db.Column(db.Enum('roll','move','kill','enter','win'), default='move')
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'player': self.player, 'dice_value': self.dice_value,
                'token_index': self.token_index, 'from': self.from_position,
                'to': self.to_position, 'type': self.move_type}


class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'
    id         = db.Column(db.Integer, primary_key=True)
    room_id    = db.Column(db.String(8), db.ForeignKey('rooms.room_id', ondelete='CASCADE'))
    username   = db.Column(db.String(50))
    message    = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'username': self.username, 'message': self.message,
                'time': self.created_at.strftime('%H:%M')}
