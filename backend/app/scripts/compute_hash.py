import sys
import hashlib

def main() -> None:
    """
    Function to generate a SHA-256 hash from a provided string.
    """

    # Check if the correct number of arguments is provided
    if len(sys.argv) != 2:
        # Print usage message and exit
        print("Usage: python generate_sha256.py <string>")
        sys.exit(1)

    # Compute the SHA-256 hash
    plain = sys.argv[1].encode("utf-8")

    # Generate the hash
    digest = hashlib.sha256(plain).hexdigest()

    # Print the generated hash
    print(digest)

if __name__ == "__main__":
    main()