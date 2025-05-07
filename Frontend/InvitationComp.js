const fileInput = document.getElementById("fileInput");
const meetInfo = document.getElementById("meetInfo");
const swimmersSection = document.getElementById("eligibleSwimmers");
const swimmersList = document.getElementById("swimmersList");
const errorSection = document.getElementById("errorSection");

// Замести с реални данни на текущия потребител
const user = {
  id: "текущо-id",
  clubID: "club-id-на-потребителя"
};

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  resetUI();
  try {
    const zip = await JSZip.loadAsync(file);
    const xmlFileName = Object.keys(zip.files).find(f => f.endsWith(".xml") || f.endsWith(".lxf") || f.endsWith(".lef"));

    if (!xmlFileName) return showError("❌ Не е намерен XML файл в архива.");

    const xmlContent = await zip.files[xmlFileName].async("text");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

    if (xmlDoc.getElementsByTagName("parsererror").length > 0)
      return showError("⚠️ Грешка при парсване на XML.");

    const meet = xmlDoc.querySelector("MEET");
    const meetName = meet?.getAttribute("name") || "Неизвестно състезание";
    const city = meet?.getAttribute("city") || "Неизвестен град";
    const pool = meet.querySelector("POOL")?.getAttribute("name") || "Неизвестен басейн";
    const sessions = xmlDoc.querySelectorAll("SESSION");

    const sessionDates = Array.from(sessions).map(s => s.getAttribute("date")).filter(Boolean);
    const meetDate = sessionDates.sort()[0] || new Date().toISOString().split("T")[0];

    const ageGroups = Array.from(xmlDoc.querySelectorAll("AGEGROUP")).map(ag => ({
      minAge: parseInt(ag.getAttribute("minAge")),
      maxAge: parseInt(ag.getAttribute("maxAge")),
    }));

    showMeetInfo(meetName, city, pool, sessionDates);

    const clubUsers = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`, {
      headers: {
        'Content-Type': 'application/json',
        'Requester-Id': user.id
      }
    }).then(res => res.json());

    const eligible = clubUsers.filter(swimmer => {
      const age = calculateAge(swimmer.birthDate, meetDate);
      return ageGroups.some(g => age >= g.minAge && age <= g.maxAge);
    });

    if (eligible.length === 0) {
      swimmersList.innerHTML = "<li>Няма състезатели, отговарящи на възрастовите групи.</li>";
    } else {
      swimmersList.innerHTML = "";
      eligible.forEach(swimmer => {
        const li = document.createElement("li");
        li.textContent = `${swimmer.firstName} ${swimmer.lastName} – ${calculateAge(swimmer.birthDate, meetDate)} г.`;
        swimmersList.appendChild(li);
      });
    }

    swimmersSection.classList.remove("hidden");

  } catch (err) {
    console.error(err);
    showError("❌ Възникна грешка при обработка на файла.");
  }
});

function resetUI() {
  meetInfo.innerHTML = "";
  meetInfo.classList.add("hidden");
  swimmersSection.classList.add("hidden");
  errorSection.textContent = "";
  errorSection.classList.add("hidden");
}

function showMeetInfo(name, city, pool, dates) {
  meetInfo.innerHTML = `
    <h2>${name} (${city})</h2>
    <p>🏟️ Басейн: <strong>${pool}</strong></p>
    <p>🗓️ Дати на сесиите: ${dates.join(", ")}</p>
  `;
  meetInfo.classList.remove("hidden");
}

function showError(msg) {
  errorSection.textContent = msg;
  errorSection.classList.remove("hidden");
}

function calculateAge(birthDateStr, referenceDateStr) {
  const birthDate = new Date(birthDateStr);
  const refDate = new Date(referenceDateStr);
  let age = refDate.getFullYear() - birthDate.getFullYear();
  const m = refDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < birthDate.getDate())) age--;
  return age;
}
