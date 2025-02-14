import { auth, db, storage } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, 
  getDoc, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// Funzione helper per formattare le date (gg/mm/aaaa)
function formatDate(dateString) {
  if (!dateString) return "";
  const [anno, mese, giorno] = dateString.split("-");
  return `${giorno}/${mese}/${anno}`;
}

// Registrazione del Service Worker per la PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registrato con successo:', registration);
      })
      .catch(error => {
        console.error('Registrazione Service Worker fallita:', error);
      });
  });
}

// Elementi per login/registrazione
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');

// Mostra/nascondi form
showRegisterBtn.addEventListener('click', () => {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
});
showLoginBtn.addEventListener('click', () => {
  registerForm.style.display = 'none';
  loginForm.style.display = 'block';
});

// Login
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  signInWithEmailAndPassword(auth, email, password)
    .catch(error => alert("Errore di accesso: " + error.message));
});

// Registrazione
registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      return addDoc(collection(db, "users"), {
        uid: userCredential.user.uid,
        email: email,
        isAdmin: false
      });
    })
    .then(() => { alert("Registrazione completata con successo!"); })
    .catch(error => alert("Errore durante la registrazione: " + error.message));
});

// Logout
logoutBtn.addEventListener('click', () => { signOut(auth); });

// Stato di autenticazione
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

// Calcoli per il form (dati base)
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

// Salvataggio di un nuovo lotto (incluso il campo "Data presunto carico")
const lotForm = document.getElementById('lotForm');
lotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const clientSelect = document.getElementById('clientSelect');
  const selectedClientText = clientSelect.options[clientSelect.selectedIndex].text;
  const lotNumber = document.getElementById('lotNumber').value.trim();
  const entryDate = document.getElementById('entryDate').value;
  const presuntoCarico = document.getElementById('presuntoCarico').value;
  const totalWeight = document.getElementById('totalWeight').value;
  const numHeads = document.getElementById('numHeads').value;
  const numDead = document.getElementById('numDead').value;
  const deadPercent = document.getElementById('deadPercent').value;
  const sector = document.getElementById('sector').value.trim();
  const lettera = document.getElementById('lettera').value.trim();
  const avgWeight = document.getElementById('avgWeight').value;
  const newLotto = {
    client: selectedClientText,
    lotNumber,
    entryDate,
    presuntoCarico,
    totalWeight: parseFloat(totalWeight),
    numHeads: parseInt(numHeads),
    numDead: parseInt(numDead),
    deadPercent: parseFloat(deadPercent),
    sector,
    lettera,
    avgWeight: parseFloat(avgWeight),
    animalsLoaded: 0,
    totalWeightCarico: 0,
    avgWeightCarico: 0,
    scarti: 0,
    present: 0,
    photoURL: "",
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

// Modal per visualizzare le foto
const modal = document.getElementById("photoModal");
const modalImg = document.getElementById("modalImage");
const spanClose = document.getElementsByClassName("close")[0];
spanClose.onclick = function() {
  modal.style.display = "none";
};
function showModal(photoURL) {
  console.log("Mostro il modal con URL:", photoURL);
  modalImg.src = photoURL;
  modal.style.display = "block";
}

// Caricamento dei lotti e applicazione dei filtri
function loadLotti(user) {
  let lottiQuery = query(collection(db, "lotti"), orderBy("timestamp", "desc"));
  getDoc(doc(db, "users", user.uid)).then(docSnap => {
    if (docSnap.exists() && !docSnap.data().isAdmin) {
      lottiQuery = query(collection(db, "lotti"), where("uid", "==", user.uid), orderBy("timestamp", "desc"));
    }
    onSnapshot(lottiQuery, (snapshot) => {
      const lotTableBody = document.querySelector('#lotTable tbody');
      lotTableBody.innerHTML = "";
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const currentDocId = docSnap.id;
        const entryDateFormatted = formatDate(data.entryDate);
        const presuntoCaricoFormatted = formatDate(data.presuntoCarico);
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${data.client}</td>
          <td>${data.lotNumber}</td>
          <td>${entryDateFormatted}</td>
          <td>${presuntoCaricoFormatted}</td>
          <td>${data.totalWeight.toFixed(2)}</td>
          <td>${data.numHeads}</td>
          <td>${data.numDead}</td>
          <td>${data.deadPercent.toFixed(2)}</td>
          <td>${data.sector}</td>
          <td>${data.lettera}</td>
          <td>${data.avgWeight.toFixed(2)}</td>
          <td>${data.animalsLoaded || 0}</td>
          <td>${data.totalWeightCarico ? data.totalWeightCarico.toFixed(2) : "0.00"}</td>
          <td>${data.avgWeightCarico ? data.avgWeightCarico.toFixed(2) : "0.00"}</td>
          <td>${data.scarti || 0}</td>
          <td>${data.present || 0}</td>
          <td>
            <button class="edit-btn">Modifica</button>
            <button class="delete-btn">Elimina</button>
            <button class="photo-btn">📷</button>
            <button class="view-photo-btn">👁</button>
            <button class="open-page-btn">Apri Pagina</button>
          </td>
        `;
        row.querySelector('.edit-btn').addEventListener('click', () => { editRow(row, currentDocId); });
        row.querySelector('.delete-btn').addEventListener('click', () => {
          if (confirm("Sei sicuro di voler cancellare questo record?")) {
            deleteDoc(doc(db, "lotti", currentDocId))
              .then(() => { alert("Record cancellato."); })
              .catch(error => { alert("Errore durante la cancellazione: " + error.message); });
          }
        });
        row.querySelector('.photo-btn').addEventListener('click', () => {
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/*';
          fileInput.capture = 'environment';
          fileInput.style.display = 'none';
          fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
              const storageRef = ref(storage, `lotti/${currentDocId}/photo.jpg`);
              try {
                const snapshot = await uploadBytes(storageRef, file);
                const url = await getDownloadURL(snapshot.ref);
                await updateDoc(doc(db, "lotti", currentDocId), { photoURL: url });
                alert("Foto salvata con successo!");
              } catch (error) {
                alert("Errore durante l'upload della foto: " + error.message);
              }
            }
          });
          document.body.appendChild(fileInput);
          fileInput.click();
          fileInput.remove();
        });
        row.querySelector('.view-photo-btn').addEventListener('click', () => {
          if (data.photoURL && data.photoURL.trim() !== "") {
            showModal(data.photoURL);
          } else {
            alert("Nessuna foto disponibile per questo record.");
          }
        });
        row.querySelector('.open-page-btn').addEventListener('click', () => {
          window.open(`customer.html?docId=${encodeURIComponent(currentDocId)}`, "_blank");
        });
        lotTableBody.appendChild(row);
      });
      applyFilters();
    });
  });
}

/* Funzione per i filtri */
const filterInputs = document.querySelectorAll('.filter-input');
filterInputs.forEach(input => {
  input.addEventListener('input', () => {
    applyFilters();
    updateTotals();
  });
});

function applyFilters() {
  const table = document.getElementById("lotTable");
  const tbody = table.tBodies[0];
  const rows = tbody.getElementsByTagName("tr");
  const filters = Array.from(filterInputs).map(input => input.value.toLowerCase().trim());
  
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getElementsByTagName("td");
    let rowVisible = true;
    for (let j = 0; j < filters.length; j++) {
      if (filters[j] !== "" && cells[j]) {
        const cellText = cells[j].textContent.toLowerCase();
        if (cellText.indexOf(filters[j]) === -1) {
          rowVisible = false;
          break;
        }
      }
    }
    rows[i].style.display = rowVisible ? "" : "none";
  }
  updateTotals();
}
window.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().substr(0, 10);
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => {
    if (!input.value) {
      input.value = today;
    }
  });
});

/* Funzione per aggiornare i totali (senza aggiornare il totale "presenti") */
function updateTotals() {
  let totalWeightTotal = 0;
  let totalHeadsTotal = 0;
  let totalDeadTotal = 0;
  let totalAnimalsLoaded = 0;
  let totalWeightCarico = 0;
  let totalScarti = 0;
  
  const rows = document.querySelectorAll('#lotTable tbody tr');
  rows.forEach(row => {
    if (row.style.display !== "none") {
      const cells = row.getElementsByTagName("td");
      totalWeightTotal += parseFloat(cells[4].textContent) || 0;
      totalHeadsTotal += parseInt(cells[5].textContent) || 0;
      totalDeadTotal += parseInt(cells[6].textContent) || 0;
      totalAnimalsLoaded += parseInt(cells[11].textContent) || 0;
      totalWeightCarico += parseFloat(cells[12].textContent) || 0;
      totalScarti += parseInt(cells[14].textContent) || 0;
    }
  });
  
  const totalDeadPercent = totalHeadsTotal !== 0 ? (totalDeadTotal / totalHeadsTotal * 100) : 0;
  const totalAvgWeight = totalHeadsTotal !== 0 ? (totalWeightTotal / totalHeadsTotal) : 0;
  const totalAvgWeightCarico = totalAnimalsLoaded !== 0 ? (totalWeightCarico / totalAnimalsLoaded) : 0;
  
  document.getElementById('totalWeightTotal').textContent = totalWeightTotal.toFixed(2);
  document.getElementById('totalHeadsTotal').textContent = totalHeadsTotal;
  document.getElementById('totalDeadTotal').textContent = totalDeadTotal;
  document.getElementById('totalDeadPercent').textContent = totalDeadPercent.toFixed(2);
  document.getElementById('totalAvgWeight').textContent = totalAvgWeight.toFixed(2);
  document.getElementById('totalAnimalsLoaded').textContent = totalAnimalsLoaded;
  document.getElementById('totalWeightCarico').textContent = totalWeightCarico.toFixed(2);
  document.getElementById('totalAvgWeightCarico').textContent = totalAvgWeightCarico.toFixed(2);
  document.getElementById('totalScarti').textContent = totalScarti;
  // Il totale "presenti" non viene aggiornato poiché rimosso dall'HTML.
}

/* Funzione di editing */
function editRow(row, docId) {
  const cells = row.querySelectorAll('td');
  const originalValues = {
    client: cells[0].textContent,
    lotNumber: cells[1].textContent,
    entryDate: cells[2].textContent,
    presuntoCarico: cells[3].textContent,
    totalWeight: cells[4].textContent,
    numHeads: cells[5].textContent,
    numDead: cells[6].textContent,
    deadPercent: cells[7].textContent,
    sector: cells[8].textContent,
    lettera: cells[9].textContent
  };
  cells[0].innerHTML = `<input type="text" value="${originalValues.client}">`;
  cells[1].innerHTML = `<input type="text" value="${originalValues.lotNumber}">`;
  cells[2].innerHTML = `<input type="date" value="${originalValues.entryDate.split('/').reverse().join('-')}">`;
  cells[3].innerHTML = `<input type="date" value="${originalValues.presuntoCarico.split('/').reverse().join('-')}">`;
  cells[4].innerHTML = `<input type="number" step="0.1" value="${originalValues.totalWeight}">`;
  cells[5].innerHTML = `<input type="number" value="${originalValues.numHeads}">`;
  cells[6].innerHTML = `<input type="number" value="${originalValues.numDead}">`;
  cells[7].innerHTML = `<input type="number" step="0.1" value="${originalValues.deadPercent}">`;
  cells[8].innerHTML = `<input type="text" value="${originalValues.sector}">`;
  cells[9].innerHTML = `<input type="text" value="${originalValues.lettera}">`;
  cells[16].innerHTML = `<button class="save-btn">Salva</button> <button class="cancel-btn">Annulla</button>`;
  cells[16].querySelector('.save-btn').addEventListener('click', () => {
    const updatedClient = cells[0].querySelector('input').value;
    const updatedLotNumber = cells[1].querySelector('input').value;
    const updatedEntryDate = cells[2].querySelector('input').value;
    const updatedPresuntoCarico = cells[3].querySelector('input').value;
    const updatedTotalWeight = parseFloat(cells[4].querySelector('input').value);
    const updatedNumHeads = parseInt(cells[5].querySelector('input').value);
    const updatedNumDead = parseInt(cells[6].querySelector('input').value);
    const updatedDeadPercent = parseFloat(cells[7].querySelector('input').value);
    const updatedSector = cells[8].querySelector('input').value;
    const updatedLettera = cells[9].querySelector('input').value;
    const updatedAvgWeight = updatedNumHeads ? (updatedTotalWeight / updatedNumHeads).toFixed(2) : 0;
    const updatedData = {
      client: updatedClient,
      lotNumber: updatedLotNumber,
      entryDate: updatedEntryDate,
      presuntoCarico: updatedPresuntoCarico,
      totalWeight: updatedTotalWeight,
      numHeads: updatedNumHeads,
      numDead: updatedNumDead,
      deadPercent: updatedDeadPercent,
      sector: updatedSector,
      lettera: updatedLettera,
      avgWeight: parseFloat(updatedAvgWeight)
    };
    updateDoc(doc(db, "lotti", docId), updatedData)
      .then(() => { alert("Record aggiornato!"); })
      .catch(error => { alert("Errore durante l'aggiornamento: " + error.message); });
  });
  cells[16].querySelector('.cancel-btn').addEventListener('click', () => {
    cells[0].textContent = originalValues.client;
    cells[1].textContent = originalValues.lotNumber;
    cells[2].textContent = originalValues.entryDate;
    cells[3].textContent = originalValues.presuntoCarico;
    cells[4].textContent = originalValues.totalWeight;
    cells[5].textContent = originalValues.numHeads;
    cells[6].textContent = originalValues.numDead;
    cells[7].textContent = originalValues.deadPercent;
    cells[8].textContent = originalValues.sector;
    cells[9].textContent = originalValues.lettera;
    cells[16].innerHTML = `<button class="edit-btn">Modifica</button> <button class="delete-btn">Elimina</button> <button class="photo-btn">📷</button> <button class="view-photo-btn">👁</button> <button class="open-page-btn">Apri Pagina</button>`;
    cells[16].querySelector('.edit-btn').addEventListener('click', () => { editRow(row, docId); });
    cells[16].querySelector('.delete-btn').addEventListener('click', () => {
      if (confirm("Sei sicuro di voler cancellare questo record?")) {
        deleteDoc(doc(db, "lotti", docId))
          .then(() => { alert("Record cancellato."); })
          .catch(error => { alert("Errore durante la cancellazione: " + error.message); });
      }
    });
    cells[16].querySelector('.photo-btn').addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.capture = 'environment';
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          const storageRef = ref(storage, `lotti/${docId}/photo.jpg`);
          try {
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            await updateDoc(doc(db, "lotti", docId), { photoURL: url });
            alert("Foto salvata con successo!");
          } catch (error) {
            alert("Errore durante l'upload della foto: " + error.message);
          }
        }
      });
      document.body.appendChild(fileInput);
      fileInput.click();
      fileInput.remove();
    });
    cells[16].querySelector('.view-photo-btn').addEventListener('click', () => {
      getDoc(doc(db, "lotti", docId)).then(docSnap => {
        const recordData = docSnap.data();
        if (recordData.photoURL && recordData.photoURL.trim() !== "") {
          showModal(recordData.photoURL);
        } else {
          alert("Nessuna foto disponibile per questo record.");
        }
      });
    });
    cells[16].querySelector('.open-page-btn').addEventListener('click', () => {
      window.open(`customer.html?docId=${encodeURIComponent(docId)}`, "_blank");
    });
  });
}
// Funzione per esportare una tabella in Excel
function exportTableToExcel(tableID, filename) {
    const table = document.getElementById(tableID);
    if (!table) {
        alert("Tabella non trovata!");
        return;
    }

    let tableData = [];
    let headers = [];
    
    // Estrarre intestazioni
    const headerCells = table.querySelectorAll("thead th");
    headerCells.forEach(cell => headers.push(cell.innerText));
    tableData.push(headers);

    // Estrarre righe della tabella
    const rows = table.querySelectorAll("tbody tr");
    rows.forEach(row => {
        let rowData = [];
        row.querySelectorAll("td").forEach(cell => {
            rowData.push(cell.innerText);
        });
        tableData.push(rowData);
    });

    // Creazione del foglio Excel
    let wb = XLSX.utils.book_new();
    let ws = XLSX.utils.aoa_to_sheet(tableData);
    XLSX.utils.book_append_sheet(wb, ws, "Dati");

    // Salvare il file Excel
    XLSX.writeFile(wb, filename + ".xlsx");
}

// Caricare il file XLSX.js per l'esportazione
const script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.4/xlsx.full.min.js";
document.body.appendChild(script);
window.exportTableToExcel = exportTableToExcel;
