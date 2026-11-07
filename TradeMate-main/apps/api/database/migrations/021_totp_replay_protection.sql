-- Prevent reuse of a TOTP time-step across separate challenges and account-security operations.
ALTER TABLE user_auth_security
  ADD COLUMN IF NOT EXISTS last_totp_counter BIGINT;

ALTER TABLE user_auth_security
  ADD CONSTRAINT user_auth_security_last_totp_counter_nonnegative
  CHECK (last_totp_counter IS NULL OR last_totp_counter >= 0);
