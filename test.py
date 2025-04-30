def is_palindrome(s):
    s = ''.join(c.lower() for c in s if c.isalnum())  # Keep it clean, keep it real
    return s == s[::-1]

# Example usage:
print(is_palindrome("A man, a plan, a canal: Panama"))  # True
print(is_palindrome("racecar"))  # True
print(is_palindrome("nope"))  # False
