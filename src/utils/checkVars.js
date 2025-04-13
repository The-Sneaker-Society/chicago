export const checkEnvVars = (envVars) => {
  const missingVars = envVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error(
      `Error: Missing environment variables: ${missingVars.join(", ")}`
    );
    process.exit(1);
  }
};
