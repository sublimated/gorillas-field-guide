// React's CSSProperties type doesn't include custom CSS variables. Cast the whole
// style object once at the call site instead of casting each `any` key.
import type { CSSProperties } from 'react';

export type CSSVars = CSSProperties & Record<`--${string}`, string | number>;
