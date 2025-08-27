export {};
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_COMPANY_NAME: string;
      NEXT_PUBLIC_API_BASE_URL: string;
    }
  }
}