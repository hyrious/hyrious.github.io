import os

STOP_WORDS = 'a an and at but by for in nor of on or so the to up yet'.split()

def is_valid_name(name: str) -> bool:
    return name.endswith('.html') and not name.startswith('_')

def capitalize(word: str) -> str:
    return word if word in STOP_WORDS else word[0].upper() + word[1:]

def title_case(name: str) -> str:
    return ' '.join(map(capitalize, name.split('-')))

def is_valid_entry(entry) -> bool:
    return is_valid_name(entry.name) and entry.is_file()

def main():
    with os.scandir('p') as it:
        for entry in filter(is_valid_entry, it):
            title = title_case(entry.name.rstrip(".html"))
            print(f'<p><a href="p/{entry.name}">{title}</a></p>')

if __name__ == '__main__':
    main()
