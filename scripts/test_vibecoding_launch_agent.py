from pathlib import Path


def test_launch_agent_installer_runs_from_synced_application_support_copy() -> None:
    repository_root = Path(__file__).resolve().parents[1]
    installer = (repository_root / "scripts" / "install-vibecoding-launch-agent.sh").read_text(
        encoding="utf-8"
    )

    assert 'RUNTIME_DIR="$HOME/Library/Application Support/vibecoding/runtime"' in installer
    assert 'RUNTIME_APP_DIR="$RUNTIME_DIR/apps/vibecoding"' in installer
    assert '"WorkingDirectory": str(root_dir)' in installer
    assert 'f"cd {shlex.quote(str(root_dir))} && exec scripts/start-vibecoding-local.sh"' in installer
    assert '"VIBECODING_ENV_FILE": str(root_dir / "apps" / "vibecoding" / ".env.local")' in installer
    assert "shutil.copytree" in installer
    assert "0005_add_market_signal_snapshots.py" in installer


if __name__ == "__main__":
    test_launch_agent_installer_runs_from_synced_application_support_copy()
