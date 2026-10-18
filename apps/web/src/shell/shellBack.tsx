import { createContext, use, useState, type ReactNode } from 'react';

const ShellBackContext = createContext<HTMLElement | null>(null);

export function ShellBackProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  return (
    <ShellBackContext value={host}>
      <ShellBackHostContext value={setHost}>{children}</ShellBackHostContext>
    </ShellBackContext>
  );
}

const ShellBackHostContext = createContext<(node: HTMLElement | null) => void>(() => undefined);

export function ShellBackHost() {
  const setHost = use(ShellBackHostContext);
  return <div className="os-shell-back" ref={setHost} />;
}

export function useShellBackHost(): HTMLElement | null {
  return use(ShellBackContext);
}
