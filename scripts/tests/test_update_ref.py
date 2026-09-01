import importlib.util
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "update-ref.py"


def load_update_ref_module():
    spec = importlib.util.spec_from_file_location("update_ref", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class UpdateFetchDocsRefsTests(unittest.TestCase):
    def test_yocto_docs_uses_latest_yocto_tag_commit(self):
        module = load_update_ref_module()

        bitbake_docs_commit = "b" * 40
        yocto_zeus_commit = "z" * 40
        yocto_60_commit = "6" * 40
        yocto_61_m1_commit = "1" * 40
        yocto_61_m2_tag_object = "26a25a43c4e5c63a6507ad20e73d5b6143618cf5"
        yocto_61_m2_commit = "358519ca6406a89fee42c45dcaf63a37a374f33c"

        def fake_git_ls_remote(*args):
            if args == (
                "--refs",
                "--sort=-v:refname",
                "https://github.com/openembedded/bitbake.git",
            ):
                return [(bitbake_docs_commit, "refs/tags/yocto-6.0")]

            if args == (
                "--tags",
                "--sort=-v:refname",
                "https://git.yoctoproject.org/yocto-docs",
                "refs/tags/yocto-*",
            ):
                return [
                    (yocto_61_m2_tag_object, "refs/tags/yocto-6.1_M2"),
                    (yocto_61_m2_commit, "refs/tags/yocto-6.1_M2^{}"),
                    (yocto_61_m1_commit, "refs/tags/yocto-6.1_M1"),
                    (yocto_60_commit, "refs/tags/yocto-6.0"),
                ]

            if args == (
                "--refs",
                "--sort=-v:refname",
                "https://git.yoctoproject.org/yocto-docs",
            ):
                return [
                    (yocto_zeus_commit, "refs/tags/zeus-22.0.4"),
                    (yocto_61_m2_tag_object, "refs/tags/yocto-6.1_M2"),
                    (yocto_61_m1_commit, "refs/tags/yocto-6.1_M1"),
                    (yocto_60_commit, "refs/tags/yocto-6.0"),
                ]

            raise AssertionError(f"Unexpected git ls-remote arguments: {args!r}")

        with tempfile.TemporaryDirectory() as temp_dir:
            repo_root = Path(temp_dir)
            scripts_dir = repo_root / "scripts"
            scripts_dir.mkdir()
            fetch_docs = scripts_dir / "fetch-docs.sh"
            fetch_docs.write_text(
                textwrap.dedent(
                    """\
                    #!/bin/bash

                    # Tag: old-bitbake-docs
                    BITBAKE_DOCS_COMMIT=old-bitbake-commit
                    # Tag: old-yocto-docs
                    YOCTO_DOCS_COMMIT=old-yocto-commit
                    """
                )
            )

            with (
                mock.patch.object(module, "REPO_ROOT", repo_root),
                mock.patch.object(module, "git_ls_remote", side_effect=fake_git_ls_remote),
            ):
                module.update_fetch_docs_refs()

            self.assertEqual(
                fetch_docs.read_text(),
                textwrap.dedent(
                    f"""\
                    #!/bin/bash

                    # Tag: yocto-6.0
                    BITBAKE_DOCS_COMMIT={bitbake_docs_commit}
                    # Tag: yocto-6.1_M2
                    YOCTO_DOCS_COMMIT={yocto_61_m2_commit}
                    """
                ),
            )
            self.assertNotIn("zeus-22.0.4", fetch_docs.read_text())
            self.assertNotIn(yocto_zeus_commit, fetch_docs.read_text())
            self.assertNotIn(yocto_61_m2_tag_object, fetch_docs.read_text())


if __name__ == "__main__":
    unittest.main()
