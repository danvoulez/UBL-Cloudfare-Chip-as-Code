export const q = (env: any) => (sql: string, ...args: any[]) => env.OFFICE_DB.prepare(sql).bind(...args);
