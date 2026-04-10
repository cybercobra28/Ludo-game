"""Ludo Game Engine — Core Logic"""
import random
from typing import List, Dict, Optional

BOARD_SIZE      = 52
WIN_POSITION    = 57
SAFE_ZONES      = {0, 8, 13, 21, 26, 34, 39, 47}
COLOR_ORDER     = ['red', 'blue', 'green', 'yellow']
COLOR_START     = {'red': 0, 'blue': 13, 'green': 26, 'yellow': 39}
HOME_STRETCH_BASE = {'red': 100, 'blue': 200, 'green': 300, 'yellow': 400}


def get_path(color: str) -> List[int]:
    start = COLOR_START[color]
    main  = [(start + i) % BOARD_SIZE for i in range(BOARD_SIZE)]
    base  = HOME_STRETCH_BASE[color]
    home  = [base + i for i in range(1, 7)]
    return main + home


def get_board_position(color: str, path_index: int) -> Optional[int]:
    if path_index < 0: return None
    path = get_path(color)
    if path_index >= len(path): return None
    return path[path_index]


def roll_dice() -> int:
    return random.randint(1, 6)


class LudoGame:
    def __init__(self, room_id: str, players: List[Dict]):
        self.room_id   = room_id
        self.players   = players
        self.colors    = [p['color'] for p in players]
        self.username_to_color = {p['username']: p['color'] for p in players}
        self.color_to_username = {p['color']: p['username'] for p in players}
        self.tokens: Dict[str, List[int]] = {p['color']: [-1,-1,-1,-1] for p in players}
        self.current_turn_index = 0
        self.dice_value: Optional[int] = None
        self.winners: List[str] = []
        self.game_over = False
        self.last_dice_rolled = False

    @property
    def current_color(self) -> str:
        return self.colors[self.current_turn_index % len(self.colors)]

    @property
    def current_player(self) -> str:
        return self.color_to_username[self.current_color]

    def get_state(self) -> Dict:
        return {'room_id': self.room_id, 'tokens': self.tokens,
                'current_color': self.current_color, 'current_player': self.current_player,
                'dice_value': self.dice_value, 'winners': self.winners,
                'game_over': self.game_over, 'players': self.players}

    def get_movable_tokens(self, color: str, dice: int) -> List[int]:
        movable = []
        for i, pos in enumerate(self.tokens[color]):
            if pos == WIN_POSITION - 1: continue
            if pos == -1:
                if dice == 6: movable.append(i)
            else:
                if pos + dice < len(get_path(color)): movable.append(i)
        return movable

    def roll(self, username: str) -> Dict:
        color = self.username_to_color.get(username)
        if color != self.current_color: return {'error': 'Not your turn'}
        if self.last_dice_rolled:       return {'error': 'Already rolled'}
        self.dice_value = roll_dice()
        self.last_dice_rolled = True
        movable = self.get_movable_tokens(color, self.dice_value)
        if not movable:
            result = {'dice': self.dice_value, 'color': color, 'movable_tokens': [], 'auto_pass': True}
            self._advance_turn()
            return result
        return {'dice': self.dice_value, 'color': color, 'movable_tokens': movable, 'auto_pass': False}

    def move_token(self, username: str, token_index: int) -> Dict:
        color = self.username_to_color.get(username)
        if color != self.current_color: return {'error': 'Not your turn'}
        if not self.last_dice_rolled:   return {'error': 'Roll dice first'}
        dice = self.dice_value
        current_pos = self.tokens[color][token_index]
        events, killed = [], []
        new_pos = 0 if current_pos == -1 else current_pos + dice
        if current_pos == -1 and dice != 6: return {'error': 'Need 6 to enter'}
        path = get_path(color)
        if new_pos >= len(path): return {'error': 'Cannot move that far'}
        old_pos = current_pos
        self.tokens[color][token_index] = new_pos
        events.append({'type': 'move', 'color': color, 'token': token_index, 'from': old_pos, 'to': new_pos})
        won = False
        if new_pos == WIN_POSITION - 1: won = self._check_win(color)
        if won: events.append({'type': 'win', 'color': color, 'player': username})
        board_cell = get_board_position(color, new_pos)
        if board_cell is not None and board_cell < 100 and board_cell not in SAFE_ZONES:
            killed = self._check_kills(color, token_index, new_pos, board_cell)
            for k in killed:
                events.append({'type': 'kill', 'killer': color, 'victim_color': k['color'], 'victim_token': k['token']})
        extra = dice == 6 or bool(killed)
        result = {'dice': dice, 'color': color, 'token': token_index, 'new_pos': new_pos,
                  'events': events, 'killed': killed, 'extra_turn': extra,
                  'game_over': self.game_over, 'winners': self.winners, 'state': self.get_state()}
        self.last_dice_rolled = False
        self.dice_value = None
        if not extra: self._advance_turn()
        return result

    def _check_kills(self, mover_color, mover_token, mover_path_idx, board_cell):
        killed = []
        for color, positions in self.tokens.items():
            if color == mover_color: continue
            for i, pos in enumerate(positions):
                if pos < 0: continue
                opp_cell = get_board_position(color, pos)
                if opp_cell == board_cell and opp_cell is not None and opp_cell < 100:
                    self.tokens[color][i] = -1
                    killed.append({'color': color, 'token': i, 'player': self.color_to_username[color]})
        return killed

    def _check_win(self, color):
        if all(p == WIN_POSITION - 1 for p in self.tokens[color]):
            if color not in self.winners: self.winners.append(color)
            self.game_over = True
            return True
        return False

    def _advance_turn(self):
        self.current_turn_index = (self.current_turn_index + 1) % len(self.colors)
        attempts = 0
        while self.current_color in self.winners and attempts < len(self.colors):
            self.current_turn_index = (self.current_turn_index + 1) % len(self.colors)
            attempts += 1

    def to_db_dict(self):
        return {'room_id': self.room_id, 'tokens': self.tokens, 'current_color': self.current_color,
                'current_player': self.current_player, 'winners': self.winners,
                'game_over': self.game_over, 'players': self.players,
                'current_turn_index': self.current_turn_index}

    @classmethod
    def from_db_dict(cls, data):
        game = cls(data['room_id'], data['players'])
        game.tokens = data['tokens']
        game.current_turn_index = data.get('current_turn_index', 0)
        game.winners = data.get('winners', [])
        game.game_over = data.get('game_over', False)
        return game
