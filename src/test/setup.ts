import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so testing-library's automatic cleanup isn't registered.
afterEach(cleanup);
