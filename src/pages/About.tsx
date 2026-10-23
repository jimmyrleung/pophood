import notices from "../../THIRD-PARTY-NOTICES.md?raw";
import pkg from "../../package.json";
import { useSensorStatus } from "../sensors/store";

const LHM_VERSION = "0.9.6";
const LHM_COMMIT = "3d331e3370efb858411f19511373eff65a218701";
const LHM_URL = "https://github.com/LibreHardwareMonitor/LibreHardwareMonitor";

interface Props {
  onBack: () => void;
}

/**
 * Versions, the helper hash this build expects, and the licence notices. URLs are text, never links: navigation is
 * pinned to the app's own origin (a link would do nothing, or worse).
 */
export function About({ onBack }: Props) {
  const status = useSensorStatus();
  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="breadcrumb__link" onClick={onBack}>
          Dashboard
        </button>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">About and licenses</span>
      </nav>
      <header>
        <h1 className="page-title">About and licenses</h1>
        <p className="page-sub">Pophood {pkg.version}</p>
      </header>

      <section className="about" aria-label="Versions">
        <dl className="about__facts">
          <div>
            <dt>Pophood</dt>
            <dd>{pkg.version}</dd>
          </div>
          <div>
            <dt>LibreHardwareMonitor</dt>
            <dd>
              LHM {LHM_VERSION} @ {LHM_COMMIT.slice(0, 7)}
            </dd>
          </div>
          <div>
            <dt>Sensor helper SHA-256 (the one this build expects)</dt>
            <dd className="about__mono">{status.helperSha256 === "" ? "not reported yet" : status.helperSha256}</dd>
          </div>
          <div>
            <dt>LibreHardwareMonitor source</dt>
            <dd className="about__mono">
              {LHM_URL} at commit {LHM_COMMIT}
            </dd>
          </div>
        </dl>
      </section>

      <section className="about" aria-label="Licenses">
        <h2 className="about__title">Third-party notices</h2>
        <pre className="about__notices">{notices}</pre>
      </section>
    </>
  );
}
