import { Link, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';

export function DashboardPage() {
  const { currentUser } = useOutletContext<AppContext>();
  const isGuest = !currentUser || currentUser.role === 'guest';

  if (isGuest) {
    return (
      <div className="page page-dashboard">
        <div className="page-shell">
          <header className="page-head">
            <h1>Moj prostor</h1>
            <p className="page-sub">
              Ulogujte se da personalizujete pregled: pratite omiljene objekte, dobijate dešavanja iz vaših
              sela i poruke od servisera.
            </p>
          </header>
          <div className="dashboard-cta-row">
            <Link to="/prijava" className="btn-primary">
              Prijava
            </Link>
            <Link to="/registracija" className="btn-secondary">
              Otvori nalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-dashboard">
      <div className="page-shell">
        <header className="page-head">
          <h1>Moj prostor</h1>
          <p className="page-sub">Dobrodošli, {currentUser.displayName}.</p>
        </header>

        <section className="dashboard-section">
          <h2>Pratim objekte</h2>
          <p className="empty-state">
            Još uvek ne pratite nijedan objekat. Ova sekcija će prikazati dešavanja sa objekata koje
            označite.
          </p>
          <Link to="/objekti" className="link-cta">
            Pretraži objekte →
          </Link>
        </section>

        <section className="dashboard-section">
          <h2>Najnovija dešavanja iz mojih sela</h2>
          <p className="empty-state">
            Izaberite sela koja vas zanimaju da bismo vam ovde prikazali najnovija dešavanja.
          </p>
        </section>

        <section className="dashboard-section">
          <h2>Poruke</h2>
          <p className="empty-state">Nemate novih poruka.</p>
        </section>

        <div className="dashboard-foot-links">
          <Link to="/nalog" className="link-cta">
            Idi na moj nalog (omiljeno, komentari, rezervacije) →
          </Link>
        </div>
      </div>
    </div>
  );
}
