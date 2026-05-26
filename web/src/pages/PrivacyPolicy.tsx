export function PrivacyPolicy() {
  return (
    <div className="account-page">
      <div className="account-shell">
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 500, marginTop: 0 }}>
          Politika privatnosti
        </h1>
        <div className="prose">
          <p className="prose-lead">
            Vašu privatnost shvatamo ozbiljno. Ovaj dokument objašnjava koje podatke o
            posetiocima i korisnicima sajta „Grad na dlanu“ prikupljamo, zašto ih obrađujemo i
            koja prava imate u skladu sa Zakonom o zaštiti podataka o ličnosti Republike Srbije
            („Sl. glasnik RS“, br. 87/2018) i opštim načelima GDPR-a.
          </p>

          <h2>Rukovalac podacima</h2>
          <p>
            Rukovalac obradom podataka je tim koji održava sajt u saradnji sa opštinom Žabari.
            Za pitanja u vezi sa vašim podacima možete nam pisati putem kontakt forme.
          </p>

          <h2>Koje podatke prikupljamo</h2>
          <p>
            <strong>Bez registracije:</strong> sajt funkcioniše bez prikupljanja ličnih podataka.
            Browser šalje uobičajene tehničke informacije (IP adresa, tip pregledača,
            stranica koju ste posetili) koje se mogu zadržati u tehničkim logovima radi
            otklanjanja grešaka i zaštite od zloupotreba.
          </p>
          <p>
            <strong>Uz registraciju (posetilački nalog):</strong> e-pošta, ime koje izaberete za
            prikaz, lozinka (skladišti se isključivo kao bcrypt heš — nikada u izvornom
            obliku), kao i sadržaj koji sami unesete (omiljene lokacije, komentari, prijave o
            poseti, zahtevi za rezervaciju).
          </p>
          <p>
            <strong>Vlasnici objekata:</strong> dodatno, ime objekta, kontakt podaci i sadržaj
            koji objavite o objektu (opis, ponuda, fotografije, raspored stolova/soba).
          </p>

          <h2>Svrhe obrade</h2>
          <p>
            Podatke obrađujemo kako bismo: omogućili prijavu i korišćenje naloga; prosledili
            zahteve za rezervaciju vlasnicima objekata; prikazali vaše komentare i ocene drugim
            posetiocima; održavali sigurnost sajta i sprečavali zloupotrebe; ispunili
            zakonske obaveze (npr. odgovor na zahteve nadležnih organa).
          </p>

          <h2>Pravni osnov</h2>
          <p>
            Osnov za obradu je pristanak korisnika (čl. 12 ZZPL), izvršenje ugovora o korišćenju
            sajta i naših legitimnih interesa za bezbednost i unapređenje usluge.
          </p>

          <h2>Sa kim delimo podatke</h2>
          <p>
            Podatke ne prodajemo i ne ustupamo trećim licima u marketinške svrhe. Podaci iz
            zahteva za rezervaciju vidljivi su vlasniku odgovarajućeg objekta kako bi mogao da
            potvrdi ili odbije zahtev. Tehnički pristup serverima imaju samo osobe iz tima
            koje održavaju sajt.
          </p>

          <h2>Kolačići (cookies)</h2>
          <p>
            Koristimo isključivo tehnički neophodne kolačiće i lokalno skladište pregledača
            (npr. JWT token sesije pod ključem <code>gnd.token</code>, izbor početnog prikaza).
            Ne koristimo marketinške ili analitičke kolačiće trećih strana.
          </p>

          <h2>Mape i satelitski snimci</h2>
          <p>
            Za prikaz mape koristi se servis Esri World Imagery. Vaš pregledač pri tome
            kontaktira njihove servere, što omogućava prikaz pločica satelita; politiku
            privatnosti tog servisa pogledajte na njihovom sajtu.
          </p>

          <h2>Period čuvanja</h2>
          <p>
            Podaci se čuvaju dok god je nalog aktivan i još razumno dugo nakon toga, radi
            evidencije i bezbednosti. Možete u svakom trenutku zatražiti brisanje naloga i
            povezanih ličnih podataka.
          </p>

          <h2>Vaša prava</h2>
          <p>
            Imate pravo: na pristup svojim podacima; na ispravku netačnih podataka; na brisanje
            („pravo na zaborav“); na ograničenje obrade; na povlačenje pristanka; i na
            podnošenje pritužbe Povereniku za informacije od javnog značaja i zaštitu
            podataka o ličnosti Republike Srbije.
          </p>

          <h2>Bezbednost</h2>
          <p>
            Lozinke se čuvaju kao bcrypt heševi; komunikacija sa serverom odvija se preko HTTPS-a.
            Pristup bazi podataka ograničen je na neophodne procese aplikacije.
          </p>

          <h2>Izmene politike</h2>
          <p>
            Politiku privatnosti možemo dopuniti kako bismo je uskladili sa zakonom ili novim
            funkcionalnostima. Datum poslednje izmene biće objavljen na ovoj stranici.
          </p>

          <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>Poslednja izmena: maj 2026.</p>
        </div>
      </div>
    </div>
  );
}
