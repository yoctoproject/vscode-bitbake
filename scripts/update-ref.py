#!/usr/bin/env python3

import json
import re
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def git_ls_remote(*args: str) -> list[tuple[str, str]]:
    output = subprocess.check_output(
        ["git", "ls-remote", *args],
        cwd=REPO_ROOT,
        text=True,
    )

    refs: list[tuple[str, str]] = []
    for line in output.splitlines():
        parts = line.split()
        if len(parts) == 2:
            refs.append((parts[0], parts[1]))
    return refs


def yocto_version_key(ref: str) -> tuple[int, ...]:
    tag = ref.removeprefix("refs/tags/").removesuffix("^{}")
    version = tag.removeprefix("yocto-")
    return tuple(int(part) for part in version.split("."))


def latest_yocto_release_ref(url: str) -> tuple[str, str]:
    refs = [
        (commit, ref)
        for commit, ref in git_ls_remote("--tags", url, "refs/tags/yocto-*^{}")
        if re.fullmatch(r"refs/tags/yocto-[0-9]+(\.[0-9]+)*\^\{\}", ref)
    ]

    if not refs:
        raise RuntimeError(f"Could not find Yocto release tags for {url}")

    commit, ref = sorted(refs, key=lambda item: yocto_version_key(item[1]))[-1]
    tag = ref.removeprefix("refs/tags/").removesuffix("^{}")
    return commit, tag


def latest_ref(url: str, predicate=lambda ref: True) -> tuple[str, str]:
    refs = [
        (commit, ref)
        for commit, ref in git_ls_remote("--refs", "--sort=-v:refname", url)
        if predicate(ref)
    ]

    if not refs:
        raise RuntimeError(f"Could not find matching refs for {url}")

    return refs[0]


def latest_head_or_tag_commit(url: str, branch_or_tag: str) -> str:
    refs = git_ls_remote("--heads", url, branch_or_tag)
    if refs:
        return refs[0][0]

    refs = git_ls_remote("--tags", url, f"{branch_or_tag}^{{}}", branch_or_tag)
    if refs:
        return refs[0][0]

    raise RuntimeError(f"Could not find latest revision for {url} branch/tag {branch_or_tag}")


def replace_assignment(path: Path, variable: str, value: str) -> None:
    text = path.read_text()
    pattern = re.compile(rf"^{re.escape(variable)}=.*$", re.MULTILINE)
    replacement = f"{variable}={value}"

    if not pattern.search(text):
        raise RuntimeError(f"Could not find assignment for {variable} in {path}")

    path.write_text(pattern.sub(replacement, text))


def replace_regex(path: Path, pattern: str, replacement: str) -> None:
    text = path.read_text()
    compiled = re.compile(pattern, re.MULTILINE)

    if not compiled.search(text):
        raise RuntimeError(f"Could not find pattern {pattern!r} in {path}")

    path.write_text(compiled.sub(replacement, text))


def update_tag_comment_before_assignment(path: Path, variable: str, tag: str) -> None:
    lines = path.read_text().splitlines()

    assignment_index = next(
        (index for index, line in enumerate(lines) if line.startswith(f"{variable}=")),
        None,
    )

    if assignment_index is None:
        raise RuntimeError(f"Could not find assignment for {variable} in {path}")

    for index in range(assignment_index - 1, -1, -1):
        if lines[index].startswith("# Tag: "):
            lines[index] = f"# Tag: {tag}"
            path.write_text("\n".join(lines) + "\n")
            return

    raise RuntimeError(f"Could not find # Tag comment before {variable} in {path}")


def update_fetch_poky_ref() -> None:
    fetch_poky = REPO_ROOT / "scripts/fetch-poky.sh"

    commit, tag = latest_yocto_release_ref("https://git.openembedded.org/bitbake")
    replace_assignment(fetch_poky, "BITBAKE_TAG", tag)
    replace_assignment(fetch_poky, "BITBAKE_COMMIT", commit)


def update_source_override_ref(source_name: str) -> None:
    source_overrides = REPO_ROOT / "integration-tests/fixtures/bitbake-setup/source-overrides.json"

    with source_overrides.open() as source_file:
        data = json.load(source_file)

    remote = data["sources"][source_name]["git-remote"]
    uri = remote["uri"]
    branch_or_tag = remote.get("branch", "")

    if not branch_or_tag:
        raise RuntimeError(f"Missing branch/tag for source override {source_name}")

    remote["rev"] = latest_head_or_tag_commit(uri, branch_or_tag)

    with source_overrides.open("w") as source_file:
        json.dump(data, source_file, indent=4)
        source_file.write("\n")


def update_language_versions() -> None:
    version_ts = REPO_ROOT / "integration-tests/src/utils/version.ts"

    _, bash_ref = latest_ref(
        "https://github.com/bash-lsp/bash-language-server",
        lambda ref: "vscode-client-" in ref,
    )
    bash_version = bash_ref.removeprefix("refs/tags/vscode-client-")
    replace_regex(
        version_ts,
        r"^export const bashVersion =.*$",
        f"export const bashVersion = '{bash_version}'",
    )

    _, python_ref = latest_ref("https://github.com/Microsoft/vscode-python")
    python_version = python_ref.removeprefix("refs/tags/v")
    replace_regex(
        version_ts,
        r"^export const pythonVersion =.*$",
        f"export const pythonVersion = '{python_version}'",
    )


def update_fetch_docs_refs() -> None:
    fetch_docs = REPO_ROOT / "scripts/fetch-docs.sh"

    commit, ref = latest_ref("https://github.com/openembedded/bitbake.git")
    tag = ref.removeprefix("refs/tags/")
    update_tag_comment_before_assignment(fetch_docs, "BITBAKE_DOCS_COMMIT", tag)
    replace_assignment(fetch_docs, "BITBAKE_DOCS_COMMIT", commit)

    commit, ref = latest_ref("https://git.yoctoproject.org/yocto-docs")
    tag = ref.removeprefix("refs/tags/")
    update_tag_comment_before_assignment(fetch_docs, "YOCTO_DOCS_COMMIT", tag)
    replace_assignment(fetch_docs, "YOCTO_DOCS_COMMIT", commit)


def update_vscode_version() -> None:
    run_test = REPO_ROOT / "integration-tests/src/runTest.ts"

    _, ref = latest_ref(
        "https://github.com/microsoft/vscode.git",
        lambda ref: re.fullmatch(r"refs/tags/[0-9.]+", ref) is not None,
    )
    tag = ref.removeprefix("refs/tags/")
    replace_regex(run_test, r"vscodeVersion = '.*'", f"vscodeVersion = '{tag}'")


def update_fetch_spdx_licenses_ref() -> None:
    fetch_spdx = REPO_ROOT / "scripts/fetch-spdx-licenses.sh"

    commit, ref = latest_ref("https://github.com/spdx/license-list-data.git")
    tag = ref.removeprefix("refs/tags/")
    update_tag_comment_before_assignment(fetch_spdx, "SPDX_LICENSES_COMMIT", tag)
    replace_assignment(fetch_spdx, "SPDX_LICENSES_COMMIT", commit)


def main() -> None:
    update_fetch_poky_ref()

    for source_name in ("bitbake", "openembedded-core", "meta-yocto", "yocto-docs"):
        update_source_override_ref(source_name)

    update_language_versions()
    update_fetch_docs_refs()
    update_vscode_version()
    update_fetch_spdx_licenses_ref()


if __name__ == "__main__":
    main()
