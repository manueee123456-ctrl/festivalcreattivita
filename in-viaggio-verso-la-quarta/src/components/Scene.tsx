import type { ReactNode } from "react";

export function Scene({
  bg,
  children,
  veil = true,
}: {
  bg: string;
  children: ReactNode;
  veil?: boolean;
}) {
  return (
    <div className="relative min-h-dvh scene-bg" style={{ backgroundImage: `url(${bg})` }}>
      {veil && <div className="scene-veil absolute inset-0" />}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-5 md:px-8 md:py-7">
        {children}
      </div>
    </div>
  );
}
