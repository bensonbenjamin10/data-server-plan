import { createContext, useContext, useMemo } from "react";
import { createApi } from "./api";
import { useAuth } from "./auth-context";

type ApiType = ReturnType<typeof createApi>;

const ApiContext = createContext<ApiType | null>(null);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const api = useMemo(() => createApi(getToken), [getToken]);
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiType {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used within ApiProvider");
  return api;
}
