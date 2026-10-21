function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for authenticated tests`);
  return value;
}

export function testCredentials() {
  return {
    admin: {
      email: required('SEED_ADMIN_EMAIL'),
      password: required('SEED_ADMIN_PASSWORD'),
    },
    user: {
      email: required('SEED_USER_EMAIL'),
      password: required('SEED_USER_PASSWORD'),
    },
  };
}
