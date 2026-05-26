export function LegalNotice() {
  return (
    <div className="account-page">
      <div className="account-shell">
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 500, marginTop: 0 }}>
          Pravna napomena
        </h1>
        <div className="prose">
          <p className="prose-lead">
            Sajt „Grad na dlanu“ je informativni vodič kroz opštinu Žabari (poštanski broj 12374,
            Braničevski okrug, Republika Srbija). Sadržaj služi za upoznavanje posetilaca i meštana
            sa lokalnim sadržajima — ugostiteljskim objektima, smeštajem, znamenitostima, javnim
            službama i obrazovnim ustanovama.
          </p>

          <h2>Vlasnik i izdavač</h2>
          <p>
            Sajt održava lokalni tim u saradnji sa vlasnicima objekata. Za sva pitanja koja se tiču
            sadržaja, ispravki podataka ili tehničkih grešaka možete nas kontaktirati putem
            kontakt forme na sajtu ili instagram naloga @zabarinet.
          </p>

          <h2>Tačnost podataka</h2>
          <p>
            Podaci o lokacijama (radno vreme, ponuda, cene, dostupnost, opis) preuzimaju se od
            vlasnika objekata ili javno dostupnih izvora i prikazuju se u dobroj veri. „Grad na
            dlanu“ ne garantuje da je svaki podatak u svakom trenutku ažuran i ne snosi
            odgovornost za eventualnu štetu nastalu oslanjanjem na informacije sa sajta.
            Preporučujemo da pre posete proverite radno vreme i raspoloživost direktno kod
            objekta.
          </p>

          <h2>Rezervacije</h2>
          <p>
            Funkcionalnost rezervacija (stolovi u kafićima, sobe u smeštaju) povezuje posetioca
            sa vlasnikom objekta. „Grad na dlanu“ posreduje u prosleđivanju zahteva, ali ne
            zaključuje ugovor o pružanju usluge — krajnji ugovorni odnos uspostavlja se između
            posetioca i vlasnika objekta. Vlasnik može odobriti ili odbiti rezervaciju u
            razumnom roku.
          </p>

          <h2>Komentari i sadržaj korisnika</h2>
          <p>
            Registrovani posetioci mogu ostavljati komentare i ocene. Za sadržaj koji objavi,
            isključivu odgovornost snosi sam autor komentara. Zadržavamo pravo da uklonimo
            komentare koji krše zakon, vređaju druga lica, sadrže lažne navode ili spam, bez
            prethodne najave.
          </p>

          <h2>Autorska prava</h2>
          <p>
            Tekstovi, dizajn, ikonografija i kod sajta zaštićeni su odgovarajućim pravima
            intelektualne svojine. Fotografije i logotipi objekata pripadaju njihovim
            vlasnicima i koriste se uz dozvolu ili u svrhu informisanja javnosti. Preuzimanje
            sadržaja u komercijalne svrhe nije dozvoljeno bez pisane saglasnosti.
          </p>

          <h2>Spoljni linkovi</h2>
          <p>
            Sajt može sadržati linkove ka spoljnim stranicama (zvanični sajtovi ustanova,
            društvene mreže objekata, mape). Za sadržaj i politike tih sajtova ne odgovaramo.
          </p>

          <h2>Izmene napomene</h2>
          <p>
            Pravnu napomenu možemo s vremena na vreme dopuniti. Datum poslednje izmene biće
            objavljen na ovoj stranici.
          </p>

          <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>Poslednja izmena: maj 2026.</p>
        </div>
      </div>
    </div>
  );
}
