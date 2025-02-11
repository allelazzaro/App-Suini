// script.js
import { auth, db } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, 
  getDoc, doc, updateDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Elementi per login/registrazione
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');

// Mostra il form di registrazione
showRegisterBtn.addEventListener('click', () => {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
});

// Torna al login
showLoginBtn.addEventListener('click', () => {
  registerForm.style.display = 'none';
  loginForm.style.display = 'block';
});

// Gestione Login
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  signInWithEmailAndPassword(auth, email, password)
    .catch(error => alert("Errore di login: " + error.message));
});

// Gestione Registrazione
registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Salva dati utente in Firestore con isAdmin false per default
      return addDoc(collection(db, "users"), {
        uid: userCredential.user.uid,
        email: email,
        isAdmin: false
      });
    })
    .then(() => {
      alert("Registrazione completata con successo!");
    })
    .catch(error => alert("Errore di registrazione: " + error.message));
});

// Logout
logoutBtn.addEventListener('click', () => {
  signOut(auth);
});

// Gestione dello stato di autenticazione
onAuthStateChanged(auth, user => {
  if (user) {
    loginContainer.style.display = 'none';
    appContainer.style.display = 'block';
    loadLotti(user);
  } else {
    loginContainer.style.display = 'block';
    appContainer.style.display = 'none';
  }
});

// Calcoli automatici nella form
function updateFormCalculations() {
  const totalWeight = parseFloat(document.getElementById('totalWeight').value);
  const numHeads = parseFloat(document.getElementById('numHeads').value);
  const numDead = parseFloat(document.getElementById('numDead').value);
  const avgWeightInput = document.getElementById('avgWeight');
  const deadPercentInput = document.getElementById('deadPercent');
  if (!isNaN(totalWeight) && !isNaN(numHeads) && numHeads !== 0) {
    avgWeightInput.value = (totalWeight / numHeads).toFixed(2);
  } else {
    avgWeightInput.value = '';
  }
  if (!isNaN(numHeads) && numHeads !== 0 && !isNaN(numDead)) {
    deadPercentInput.value = ((numDead / numHeads) * 100).toFixed(2);
  } else {
    deadPercentInput.value = '';
  }
}
document.getElementById('totalWeight').addEventListener('input', updateFormCalculations);
document.getElementById('numHeads').addEventListener('input', updateFormCalculations);
document.getElementById('numDead').addEventListener('input', updateFormCalculations);

// Gestione pulsante fotocamera: apre il file input per scattare una foto sui dispositivi mobili
document.getElementById('cameraBtn').addEventListener('click', () => {
  document.getElementById('photoInput').click();
});

// Salva un nuovo lotto in Firestore
const lotForm = document.getElementById('lotForm');
lotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const clientSelect = document.getElementById('clientSelect');
  const selectedClientText = clientSelect.options[clientSelect.selectedIndex].text;
  const lotNumber = document.getElementById('lotNumber').value.trim();
  const entryDate = document.getElementById('entryDate').value;
  const totalWeight = document.getElementById('totalWeight').value;
  const numHeads = document.getElementById('numHeads').value;
  const numDead = document.getElementById('numDead').value;
  const deadPercent = document.getElementById('deadPercent').value;
  const sector = document.getElementById('sector').value.trim();
  const avgWeight = document.getElementById('avgWeight').value;

  const newLotto = {
    client: selectedClientText,
    lotNumber,
    entryDate,
    totalWeight: parseFloat(totalWeight),
    numHeads: parseInt(numHeads),
    numDead: parseInt(numDead),
    deadPercent: parseFloat(deadPercent),
    sector,
    avgWeight: parseFloat(avgWeight),
    uid: auth.currentUser.uid,
    timestamp: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "lotti"), newLotto);
    lotForm.reset();
    document.getElementById('entryDate').value = new Date().toISOString().substr(0, 10);
  } catch (error) {
    alert("Errore nel salvataggio: " + error.message);
  }
});

// Carica i lotti dalla collezione Firestore
function loadLotti(user) {
  let lottiQuery = query(collection(db, "lotti"), orderBy("timestamp", "desc"));
  // Se l'utente non è admin, mostra solo i lotti creati da lui
  getDoc(doc(db, "users", user.uid)).then(docSnap => {
    if (docSnap.exists() && !docSnap.data().isAdmin) {
      lottiQuery = query(collection(db, "lotti"), where("uid", "==", user.uid), orderBy("timestamp", "desc"));
    }
    onSnapshot(lottiQuery, (snapshot) => {
      const lotTableBody = document.querySelector('#lotTable tbody');
      lotTableBody.innerHTML = "";
      snapshot.forEach(doc => {
        const data = doc.data();
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${data.client}</td>
          <td>${data.lotNumber}</td>
          <td>${data.entryDate}</td>
          <td>${data.totalWeight.toFixed(2)}</td>
          <td>${data.numHeads}</td>
          <td>${data.numDead}</td>
          <td>${data.deadPercent.toFixed(2)}</td>
          <td>${data.sector}</td>
          <td>${data.avgWeight.toFixed(2)}</td>
          <td><button class="edit-btn">Edit</button></td>
        `;
        row.querySelector('.edit-btn').addEventListener('click', () => {
          editRow(row, doc.id);
        });
        lotTableBody.appendChild(row);
      });
      updateTotals();
    });
  });
}

// Aggiorna i totali sommando i valori delle righe visibili nella tabella
function updateTotals() {
  let totalWeightSum = 0, totalHeadsSum = 0, totalDeadSum = 0;
  const rows = document.querySelectorAll('#lotTable tbody tr');
  rows.forEach(row => {
    if (row.style.display !== "none") {
      totalWeightSum += parseFloat(row.children[3].textContent) || 0;
      totalHeadsSum += parseInt(row.children[4].textContent) || 0;
      totalDeadSum += parseInt(row.children[5].textContent) || 0;
    }
  });
  document.getElementById('totalWeightTotal').textContent = totalWeightSum.toFixed(2);
  document.getElementById('totalHeadsTotal').textContent = totalHeadsSum;
  document.getElementById('totalDeadTotal').textContent = totalDeadSum;
  const totDeadPercent = totalHeadsSum !== 0 ? ((totalDeadSum / totalHeadsSum) * 100).toFixed(2) : '0.00';
  document.getElementById('totalDeadPercent').textContent = totDeadPercent;
  const totAvgWeight = totalHeadsSum !== 0 ? (totalWeightSum / totalHeadsSum).toFixed(2) : '0.00';
  document.getElementById('totalAvgWeight').textContent = totAvgWeight;
}

/* Esempio di implementazione di editRow.
   Questa funzione trasforma le celle della riga in input per consentire l'editing e aggiunge pulsanti "Save" e "Cancel". */
function editRow(row, docId) {
  const cells = row.querySelectorAll('td');
  // Salva i valori originali per poter annullare le modifiche
  const originalValues = {
    client: cells[0].textContent,
    lotNumber: cells[1].textContent,
    entryDate: cells[2].textContent,
    totalWeight: cells[3].textContent,
    numHeads: cells[4].textContent,
    numDead: cells[5].textContent,
    sector: cells[7].textContent
  };

  // Sostituisci le celle con input (modifichiamo solo i campi editabili)
  cells[0].innerHTML = `<input type="text" value="${originalValues.client}">`;
  cells[1].innerHTML = `<input type="text" value="${originalValues.lotNumber}">`;
  cells[2].innerHTML = `<input type="date" value="${originalValues.entryDate}">`;
  cells[3].innerHTML = `<input type="number" step="0.1" value="${originalValues.totalWeight}">`;
  cells[4].innerHTML = `<input type="number" value="${originalValues.numHeads}">`;
  cells[5].innerHTML = `<input type="number" value="${originalValues.numDead}">`;
  cells[7].innerHTML = `<input type="text" value="${originalValues.sector}">`;

  // I campi computati verranno ricalcolati al salvataggio
  // Sostituisci la cella delle azioni con i pulsanti "Save" e "Cancel"
  cells[9].innerHTML = `<button class="save-btn">Save</button> <button class="cancel-btn">Cancel</button>`;

  // Aggiungi evento al pulsante Save per aggiornare i dati su Firestore
  cells[9].querySelector('.save-btn').addEventListener('click', () => {
    const updatedClient = cells[0].querySelector('input').value;
    const updatedLotNumber = cells[1].querySelector('input').value;
    const updatedEntryDate = cells[2].querySelector('input').value;
    const updatedTotalWeight = parseFloat(cells[3].querySelector('input').value);
    const updatedNumHeads = parseInt(cells[4].querySelector('input').value);
    const updatedNumDead = parseInt(cells[5].querySelector('input').value);
    const updatedSector = cells[7].querySelector('input').value;
    const updatedAvgWeight = updatedNumHeads ? (updatedTotalWeight / updatedNumHeads).toFixed(2) : 0;
    const updatedDeadPercent = updatedNumHeads ? ((updatedNumDead / updatedNumHeads) * 100).toFixed(2) : 0;

    const updatedData = {
      client: updatedClient,
      lotNumber: updatedLotNumber,
      entryDate: updatedEntryDate,
      totalWeight: updatedTotalWeight,
      numHeads: updatedNumHeads,
      numDead: updatedNumDead,
      sector: updatedSector,
      avgWeight: parseFloat(updatedAvgWeight),
      deadPercent: parseFloat(updatedDeadPercent)
    };

    // Aggiorna il documento su Firestore
    updateDoc(doc(db, "lotti", docId), updatedData)
      .then(() => {
        alert("Record aggiornato!");
        // Una volta aggiornato, il listener onSnapshot aggiornerà automaticamente la tabella.
      })
      .catch(error => {
        alert("Errore durante l'aggiornamento: " + error.message);
      });
  });

  // Evento Cancel: ripristina i valori originali
  cells[9].querySelector('.cancel-btn').addEventListener('click', () => {
    cells[0].textContent = originalValues.client;
    cells[1].textContent = originalValues.lotNumber;
    cells[2].textContent = originalValues.entryDate;
    cells[3].textContent = originalValues.totalWeight;
    cells[4].textContent = originalValues.numHeads;
    cells[5].textContent = originalValues.numDead;
    // Ricalcola i campi computati basandosi sui valori originali
    const origTotalWeight = parseFloat(originalValues.totalWeight);
    const origNumHeads = parseInt(originalValues.numHeads);
    const origAvgWeight = origNumHeads ? (origTotalWeight / origNumHeads).toFixed(2) : "0.00";
    const origNumDead = parseInt(originalValues.numDead);
    const origDeadPercent = origNumHeads ? ((origNumDead / origNumHeads) * 100).toFixed(2) : "0.00";
    cells[6].textContent = origDeadPercent;
    cells[7].textContent = originalValues.sector;
    cells[8].textContent = origAvgWeight;
    cells[9].innerHTML = `<button class="edit-btn">Edit</button>`;
    cells[9].querySelector('.edit-btn').addEventListener('click', () => {
      editRow(row, docId);
    });
  });
}
