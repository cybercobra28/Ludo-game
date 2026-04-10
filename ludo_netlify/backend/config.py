import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'ludo-super-secret-2024-change-me')

    # Railway MySQL auto-provides MYSQL_URL or individual vars
    MYSQL_HOST     = os.environ.get('MYSQLHOST', os.environ.get('MYSQL_HOST', 'localhost'))
    MYSQL_PORT     = int(os.environ.get('MYSQLPORT', os.environ.get('MYSQL_PORT', 3306)))
    MYSQL_USER     = os.environ.get('MYSQLUSER', os.environ.get('MYSQL_USER', 'root'))
    MYSQL_PASSWORD = os.environ.get('MYSQLPASSWORD', os.environ.get('MYSQL_PASSWORD', ''))
    MYSQL_DB       = os.environ.get('MYSQLDATABASE', os.environ.get('MYSQL_DB', 'ludo_game'))

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}"
        f"@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # CORS — allow Netlify frontend
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
