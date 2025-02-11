// script.js
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

// Elementi per login/registrazione
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');

// Eventi per mostrare/nascondere form
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
    .catch(error => alert("Errore di login: " + error.message));
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
    .catch(error => alert("Errore di registrazione: " + error.message));
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

// Calcoli automatici
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

// Pulsante fotocamera nel form (già esistente)
document.getElementById('cameraBtn').addEventListener('click', () => {
  document.getElementById('photoInput').click();
});

// Salvataggio di un nuovo lotto (inizialmente senza foto)
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
    photoURL: "", // inizialmente vuoto
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

// Caricamento dei lotti
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
          <td>
            <button class="edit-btn">Edit</button>
            <button class="delete-btn">Delete</button>
            <button class="photo-btn">📷</button>
            <button class="view-photo-btn">👁</button>
          </td>
        `;
        // Edit
        row.querySelector('.edit-btn').addEventListener('click', () => {
          editRow(row, currentDocId);
        });
        // Delete
        row.querySelector('.delete-btn').addEventListener('click', () => {
          if (confirm("Sei sicuro di voler cancellare questo record?")) {
            deleteDoc(doc(db, "lotti", currentDocId))
              .then(() => { alert("Record cancellato."); })
              .catch(error => { alert("Errore durante la cancellazione: " + error.message); });
          }
        });
        // Photo: Cattura e salva la foto
        row.querySelector('.photo-btn').addEventListener('click', () => {
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/*';
          fileInput.capture = 'environment';
          fileInput.style.display = 'none';
          fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
              console.log("File selezionato:", file);
              const storageRef = ref(storage, `lotti/${currentDocId}/photo.jpg`);
              try {
                const snapshot = await uploadBytes(storageRef, file);
                console.log("UploadBytes completato:", snapshot);
                const url = await getDownloadURL(snapshot.ref);
                console.log("Download URL ottenuto:", url);
                await updateDoc(doc(db, "lotti", currentDocId), { photoURL: url });
                alert("Foto salvata con successo!");
              } catch (error) {
                console.error("Errore upload/update foto:", error);
                alert("Errore durante l'upload della foto: " + error.message);
              }
            }
          });
          document.body.appendChild(fileInput);
          fileInput.click();
          fileInput.remove();
        });
        // View Photo: Visualizza la foto se disponibile
        row.querySelector('.view-photo-btn').addEventListener('click', () => {
          if (data.photoURL && data.photoURL.trim() !== "") {
            window.open(data.photoURL, '_blank');
          } else {
            alert("Nessuna foto disponibile per questo record.");
          }
        });
        lotTableBody.appendChild(row);
      });
      updateTotals();
    });
  });
}

// Totali
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

/* Funzione di editing */
function editRow(row, docId) {
  const cells = row.querySelectorAll('td');
  const originalValues = {
    client: cells[0].textContent,
    lotNumber: cells[1].textContent,
    entryDate: cells[2].textContent,
    totalWeight: cells[3].textContent,
    numHeads: cells[4].textContent,
    numDead: cells[5].textContent,
    sector: cells[7].textContent
  };
  cells[0].innerHTML = `<input type="text" value="${originalValues.client}">`;
  cells[1].innerHTML = `<input type="text" value="${originalValues.lotNumber}">`;
  cells[2].innerHTML = `<input type="date" value="${originalValues.entryDate}">`;
  cells[3].innerHTML = `<input type="number" step="0.1" value="${originalValues.totalWeight}">`;
  cells[4].innerHTML = `<input type="number" value="${originalValues.numHeads}">`;
  cells[5].innerHTML = `<input type="number" value="${originalValues.numDead}">`;
  cells[7].innerHTML = `<input type="text" value="${originalValues.sector}">`;
  cells[9].innerHTML = `<button class="save-btn">Save</button> <button class="cancel-btn">Cancel</button>`;
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
    updateDoc(doc(db, "lotti", docId), updatedData)
      .then(() => { alert("Record aggiornato!"); })
      .catch(error => { alert("Errore durante l'aggiornamento: " + error.message); });
  });
  cells[9].querySelector('.cancel-btn').addEventListener('click', () => {
    cells[0].textContent = originalValues.client;
    cells[1].textContent = originalValues.lotNumber;
    cells[2].textContent = originalValues.entryDate;
    cells[3].textContent = originalValues.totalWeight;
    cells[4].textContent = originalValues.numHeads;
    cells[5].textContent = originalValues.numDead;
    const origTotalWeight = parseFloat(originalValues.totalWeight);
    const origNumHeads = parseInt(originalValues.numHeads);
    const origAvgWeight = origNumHeads ? (origTotalWeight / origNumHeads).toFixed(2) : "0.00";
    const origNumDead = parseInt(originalValues.numDead);
    const origDeadPercent = origNumHeads ? ((origNumDead / origNumHeads) * 100).toFixed(2) : "0.00";
    cells[6].textContent = origDeadPercent;
    cells[7].textContent = originalValues.sector;
    cells[8].textContent = origAvgWeight;
    cells[9].innerHTML = `<button class="edit-btn">Edit</button> <button class="delete-btn">Delete</button> <button class="photo-btn">📷</button> <button class="view-photo-btn">👁</button>`;
    cells[9].querySelector('.edit-btn').addEventListener('click', () => { editRow(row, docId); });
    cells[9].querySelector('.delete-btn').addEventListener('click', () => {
      if (confirm("Sei sicuro di voler cancellare questo record?")) {
        deleteDoc(doc(db, "lotti", docId))
          .then(() => { alert("Record cancellato."); })
          .catch(error => { alert("Errore durante la cancellazione: " + error.message); });
      }
    });
    // Riassocia i listener per le foto
    cells[9].querySelector('.photo-btn').addEventListener('click', () => {
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
    cells[9].querySelector('.view-photo-btn').addEventListener('click', () => {
      getDoc(doc(db, "lotti", docId)).then(docSnap => {
        const recordData = docSnap.data();
        if (recordData.photoURL && recordData.photoURL.trim() !== "") {
          window.open(recordData.photoURL, '_blank');
        } else {
          alert("Nessuna foto disponibile per questo record.");
        }
      });
    });
  });
}
