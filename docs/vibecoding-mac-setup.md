# vibecoding 맥 로컬 실행

`rockenwind/vibecoding`은 Python/FastAPI 기반의 Security/Network 채용공고 수집 및 대시보드 앱입니다. 현재 저장소에서는 `apps/vibecoding` 하위 모듈로 연결합니다.

## 최초 준비

```bash
cd apps/vibecoding
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

관리자 비밀번호 해시를 생성합니다. 아래 예시는 로컬 개발용 비밀번호를 `change-me`로 둡니다.

```bash
python -c "from argon2 import PasswordHasher; print(PasswordHasher().hash('change-me'))"
```

출력된 값을 다음 실행 환경에 넣습니다.

```bash
export JOB_AGENT_ROOT="$PWD"
export DATABASE_URL="sqlite:///$PWD/data/jobs.sqlite3"
export SESSION_SECRET="local-dev-session-secret-change-this-value"
export ADMIN_PASSWORD_HASH='위에서_생성한_argon2_해시'
```

데이터베이스를 준비합니다.

```bash
alembic upgrade head
```

## 운영 데이터베이스 연결

운영 데이터와 같은 화면을 보고 싶다면 Neon `DATABASE_URL`을 로컬 `.env.local`에 넣습니다. 값은 Neon Console의 `Connect` 화면에서 복사합니다.

```bash
cd apps/vibecoding
.venv/bin/python .tools/use_operating_database.py
```

도우미는 기존 SQLite 설정을 `.env.sqlite.local`로 백업하고, `.env.local`이 운영 Neon 데이터베이스를 바라보도록 바꿉니다. `postgresql://` 형식으로 붙여 넣어도 앱에서 쓰는 `postgresql+psycopg://` 형식으로 자동 변환합니다.

운영 DB 연결 상태는 다음 명령으로 확인합니다.

```bash
set -a
source .env.local
set +a
.venv/bin/python scripts/ops_check.py
```

`Database: PostgreSQL/Neon compatible`와 공고 수가 보이면 운영 DB 연결이 된 상태입니다.

## SQLite로 되돌리기

운영 DB 대신 로컬 SQLite를 다시 보려면 백업 파일을 복원합니다.

```bash
cd apps/vibecoding
cp .env.sqlite.local .env.local
```

그 다음 서버를 다시 시작하면 로컬 SQLite 데이터베이스를 봅니다.

## 웹 대시보드 실행

```bash
uvicorn job_agent.web.app:create_app_from_environment --factory --host 127.0.0.1 --port 8000
```

브라우저에서 `http://127.0.0.1:8000/login`을 열고, 비밀번호 `change-me`로 로그인합니다.

상위 저장소 루트에서는 아래 스크립트로 한 번에 실행할 수 있습니다.

```bash
scripts/start-vibecoding-local.sh
```

스크립트는 `apps/vibecoding/.env.local`을 읽고, 가상환경이 없으면 만들고, 마이그레이션을 적용한 뒤 `http://127.0.0.1:8000/login`에서 대시보드를 띄웁니다.

## 동작 확인

```bash
python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health/live').read().decode())"
python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health/ready').read().decode())"
```

정상이라면 각각 `{"status":"ok"}`, `{"status":"ready"}`가 출력됩니다.

## 코드 갱신

하위 모듈 코드만 갱신할 때는 다음을 실행합니다.

```bash
cd apps/vibecoding
git pull
```

상위 저장소에서 하위 모듈 포인터까지 기록하려면, 갱신 후 상위 저장소로 돌아와 변경된 `apps/vibecoding` 포인터를 커밋합니다.
