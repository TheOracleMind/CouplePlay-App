#!/usr/bin/env python3
"""
Format questions from a markdown file for TypeScript array.
# Usage: python format-questions.py QUESTIONS.md
#    pip install pyperclip
"""

import sys
import pyperclip


def format_questions(input_file):
    """Read questions from file and format them for TypeScript."""
    questions = []

    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and headers
            if not line or line.startswith('#') or line.startswith('Here are'):
                continue

            # Remove numbering if present (e.g., "1. Question" -> "Question")
            if line and line[0].isdigit():
                # Find the first non-digit, non-dot, non-space character
                start_idx = 0
                for i, char in enumerate(line):
                    if char.isdigit() or char in '.→ ':
                        continue
                    start_idx = i
                    break
                line = line[start_idx:].strip()

            if line:
                # Escape double quotes and backslashes for TypeScript string
                escaped = line.replace('\\', '\\\\').replace('"', '\\"')
                questions.append(f'    "{escaped}",')

    # Join all questions with newlines
    output = '\n'.join(questions)

    return output, len(questions)


def main():
    if len(sys.argv) != 2:
        print("Usage: python format-questions.py <questions-file.md>")
        print("Example: python format-questions.py QUESTIONS.md")
        sys.exit(1)

    input_file = sys.argv[1]

    try:
        formatted_output, count = format_questions(input_file)

        # Copy to clipboard
        pyperclip.copy(formatted_output)

        print(f"✅ Successfully formatted {count} questions!")
        print(f"📋 Output copied to clipboard - ready to paste into suggested-questions.ts")
        print(f"\nPreview (first 3 lines):")
        lines = formatted_output.split('\n')
        for line in lines[:3]:
            print(line)
        if len(lines) > 3:
            print("...")

    except FileNotFoundError:
        print(f"❌ Error: File '{input_file}' not found")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
