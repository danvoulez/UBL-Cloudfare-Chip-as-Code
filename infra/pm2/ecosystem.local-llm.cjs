// Example PM2 ecosystem for LAB local LLM services (adjust to your host binaries)
module.exports = {
  apps: [
    {
      name: "ollama-serve",
      script: "bash",
      args: "-lc 'ollama serve'",
      cwd: process.env.HOME,
      env: { OLLAMA_NUM_GPU: "0" },
      autorestart: true,
      watch: false
    },
    {
      name: "ollama-pull-llama3",
      script: "bash",
      args: "-lc 'ollama pull llama3:8b-instruct'",
      autorestart: false
    }
  ]
};
