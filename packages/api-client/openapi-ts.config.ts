import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './openapi.json',
  output: 'src',
  plugins: [
    {
      name: '@hey-api/client-fetch',
      baseUrl: 'http://localhost:8000',
    },
    '@tanstack/react-query',
  ],
});
