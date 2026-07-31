export const validationMessages = {
  email: {
    invalid: "Email is not valid",
  },
  password: {
    required: "Password is required",
    min: "Password must be at least 8 characters",
    // bcrypt hashes only the first 72 bytes, so a longer password's tail does
    // nothing — the API rejects rather than pretend it counted.
    max: "Password must be at most 72 characters",
    containsUppercase: "Password must contains atleast 1 uppercase letter",
    containsSpecial: "Password must contains atleast 1 special character",
    invalid: "Password is not valid",
  },
  rePassword: {
    notMatch: "The passwords didn't match",
  },
}
