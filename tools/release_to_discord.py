"""Posts a GitHub release to Discord (run by .github/workflows/release-discord.yml).

The message: the version in the title, the release notes (the CHANGELOG section), a download link
(the release ZIP, or the release page) and links to the release and the Discord server.
Usage: DISCORD_WEBHOOK=<url> python tools/release_to_discord.py <event.json>
       python tools/release_to_discord.py <event.json> --dry-run   (prints the message, sends nothing)
"""
import json
import os
import sys
import urllib.request

NAME = 'Fear & Hunger Co-op'
COLOR = 0xC21F1F
LIMIT = 3600  # (Discord: up to 4096 characters in the text of an embed)


def build(release):
    tag = release.get('tag_name') or release.get('name') or ''
    page = release.get('html_url') or ''
    zips = [a for a in release.get('assets') or [] if a.get('name', '').lower().endswith('.zip')]
    download = zips[0]['browser_download_url'] if zips else page
    notes = (release.get('body') or '').replace('\r\n', '\n').strip()
    if len(notes) > LIMIT:
        cut = notes.rfind('\n', 0, LIMIT)
        notes = notes[:cut if cut > 0 else LIMIT].rstrip() + '\n\n... (full list on GitHub)'
    text = (notes + '\n\n' if notes else '') + '**[Download ' + tag + '](' + download + ')**  |  [Release page](' + page + ')'
    return {
        'username': NAME,
        'content': '**' + NAME + ' ' + tag + '** is out!',
        'embeds': [{
            'title': NAME + ' ' + tag,
            'url': page,
            'description': text,
            'color': COLOR,
            'footer': {'text': 'Termina and Fear & Hunger 1 - up to 4 players'},
            'timestamp': release.get('published_at'),
        }],
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    path = args[0] if args else os.environ.get('GITHUB_EVENT_PATH', '')
    with open(path, encoding='utf-8') as f:
        event = json.load(f)
    release = event.get('release')
    if not release:
        # (started by hand in Actions: the latest release of the repository)
        repo = os.environ.get('GITHUB_REPOSITORY', '')
        headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'release-to-discord'}
        if os.environ.get('GITHUB_TOKEN'):
            headers['Authorization'] = 'Bearer ' + os.environ['GITHUB_TOKEN']
        req = urllib.request.Request('https://api.github.com/repos/' + repo + '/releases/latest', headers=headers)
        with urllib.request.urlopen(req) as res:
            release = json.load(res)
    if release.get('draft'):
        print('draft release: nothing sent')
        return
    payload = build(release)
    if '--dry-run' in sys.argv:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    hook = os.environ.get('DISCORD_WEBHOOK', '').strip()
    if not hook:
        print('DISCORD_WEBHOOK is not set: nothing sent')
        return
    req = urllib.request.Request(hook, data=json.dumps(payload).encode('utf-8'),
                                 headers={'Content-Type': 'application/json', 'User-Agent': 'release-to-discord'})
    with urllib.request.urlopen(req) as res:
        print('sent to Discord:', res.status)


if __name__ == '__main__':
    main()
