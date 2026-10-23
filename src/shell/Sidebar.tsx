import { HoodIcon, MoonIcon, SunIcon } from "../icons/Icons";
import type { SensorStatus } from "../sensors/protocol";
import { toggleTheme, useTheme } from "../theme/theme";
import { TrustPanel } from "./TrustPanel";

export type Page = { page: "dashboard" } | { page: "sensors"; cardId: string } | { page: "about" };

interface Props {
  page: Page;
  status: SensorStatus;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ page, status, onNavigate }: Props) {
  const theme = useTheme();
  const onDashboard = page.page === "dashboard" || page.page === "sensors";

  return (
    <nav className="nav" aria-label="Main">
      <div className="nav__brand">
        <HoodIcon size={26} className="icon--accent" />
        <span className="nav__name">Pophood</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => toggleTheme()}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      <div className="nav__items">
        <button
          type="button"
          className="nav__item"
          aria-current={onDashboard ? "page" : undefined}
          onClick={() => onNavigate({ page: "dashboard" })}
        >
          Dashboard
        </button>
      </div>

      <TrustPanel status={status} />

      <button
        type="button"
        className="nav__about"
        aria-current={page.page === "about" ? "page" : undefined}
        onClick={() => onNavigate({ page: "about" })}
      >
        About and licenses
      </button>
    </nav>
  );
}
