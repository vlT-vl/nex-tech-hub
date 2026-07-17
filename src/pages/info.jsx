import React from 'react';
import { AiOutlineInfoCircle } from "react-icons/ai";
import pkgjson from "../../package.json";
import NexthLogo from '../components/NexthLogo';
import VltLogo from '../components/VltLogo';

const infopage = () => {
  return (
    <div className="info-container">
      <div className="info-logo-container">
        <h2 className="info-page-title">
          <AiOutlineInfoCircle className="page-head-icon" /> informazioni
        </h2>
      </div>

      <div className="info-infodata">
        <div className="info-pthlogo" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <NexthLogo iconSize={80} variant="full" />
        </div>
        <p>Versione: <strong>{pkgjson.version}</strong></p>
        <p>Build: <strong>{pkgjson.build}</strong></p>
        <p>Ultimo aggiornamento: <strong>{pkgjson.updated}</strong></p>
        <p>Build Iniziale: <strong>{pkgjson.ibuild}</strong></p>

        <ul className="info-disclaimer-list">
          <li>Tutti i marchi, nomi commerciali, loghi, segni distintivi e denominazioni eventualmente menzionati all'interno di questa applicazione sono e restano di esclusiva titolarità dei rispettivi proprietari. Il loro eventuale utilizzo avviene esclusivamente per finalità descrittive, informative, comparative o di riferimento, nei limiti consentiti dalla normativa applicabile, e non implica in alcun modo alcuna approvazione, autorizzazione, partnership, sponsorizzazione o affiliazione da parte dei relativi titolari. Restano riservati tutti i diritti non espressamente concessi.</li>
          <li>nex tech hub è un'applicazione indipendente, sviluppata e gestita autonomamente. Salvo ove espressamente indicato, essa non è affiliata, collegata, autorizzata, approvata, sponsorizzata o supportata da alcuna società, organizzazione o titolare di marchi eventualmente citati nei contenuti dell'applicazione. L'app non intende sostituire, replicare o rappresentare prodotti, servizi, piattaforme o siti ufficiali di terzi.</li>
          <li>Eventuali riferimenti a prodotti, servizi, tecnologie, denominazioni commerciali, documentazione, immagini, icone, testi o altri materiali riconducibili a terzi sono inseriti unicamente per finalità di interoperabilità, identificazione, descrizione tecnica, informazione o commento, nel rispetto della normativa vigente e dei diritti dei rispettivi titolari. Qualora un avente diritto ritenga che un contenuto violi i propri diritti, potrà contattare il titolare dell'applicazione per richiederne tempestiva verifica, rimozione o modifica.</li>
          <li>nex tech hub è fornito "così com'è" e "come disponibile", senza garanzie di alcun tipo, espresse o implicite, incluse, a titolo meramente esemplificativo e non esaustivo, garanzie di accuratezza, completezza, affidabilità, disponibilità, continuità del servizio, idoneità a uno scopo particolare, commerciabilità, sicurezza o assenza di violazioni di diritti di terzi. L'utente riconosce e accetta che l'utilizzo dell'applicazione avviene a proprio esclusivo rischio.</li>
          <li>Nei limiti massimi consentiti dalla legge applicabile, il titolare, lo sviluppatore, nonché eventuali collaboratori, fornitori o licenzianti, non potranno in alcun caso essere ritenuti responsabili per danni diretti, indiretti, incidentali, speciali, consequenziali o punitivi, né per perdite di dati, interruzioni di attività, mancati profitti, mancati risparmi, perdita di avviamento o altre perdite patrimoniali o non patrimoniali derivanti da o comunque connesse all'uso, al mancato uso, all'indisponibilità o al malfunzionamento dell'applicazione, anche qualora siano stati informati della possibilità di tali danni.</li>
          <li>Il trattamento dei dati personali eventualmente raccolti tramite l'applicazione avviene nel rispetto della normativa applicabile in materia di protezione dei dati personali, inclusi, ove applicabili, il Regolamento (UE) 2016/679 ("GDPR") e la normativa nazionale di attuazione.</li>
          <li>Il titolare si riserva il diritto di modificare in qualsiasi momento il presente disclaimer mediante pubblicazione nell'app o sul sito ufficiale. L'uso continuato dell'applicazione successivamente alla pubblicazione delle modifiche costituirà accettazione delle stesse.</li>
          <li>Salvo diversa indicazione espressa, il codice sorgente, la struttura dell'applicazione, i contenuti originali, gli elementi grafici, il layout, il design, i testi e ogni altro elemento di nex tech hub sono protetti dalla normativa in materia di proprietà intellettuale e industriale e restano riservati al relativo titolare. La pubblicazione del codice o di parte di esso su repository privati o pubblici non comporta, di per sé, alcuna concessione di licenza, autorizzazione al riutilizzo o trasferimento di diritti.</li>
          <li>Il presente disclaimer è disciplinato dalla legge italiana. Foro competente esclusivo: Milano (MI).</li>
        </ul>

        <VltLogo size="1.6rem" staticExpanded />
        <p className="info-author"><strong><a href="https://lorenzoveronesi.it/" target="_blank" rel="noopener noreferrer"> {pkgjson.author} </a></strong></p>
      </div>
    </div>
  );
};

export default infopage;
