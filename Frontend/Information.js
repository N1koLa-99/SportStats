async function fetchJson(url) {
    const response = await fetch(url);
    return response.json();
}

async function loadUser() {
    try {
        let storedUser = localStorage.getItem('user');
        if (!storedUser) {
            alert('Няма достъп до тази страница.');
            window.location.href = 'HomePage.html';
            return;
        }

        let user = JSON.parse(storedUser);

        if (user.roleID !== 2) {
            alert('Нямате права за достъп.');
            window.location.href = 'HomePage.html';
            return;
        }

        document.getElementById('coach-name').textContent = `${user.firstName} ${user.lastName}`;
        await handleCoach(user);
    } catch (error) {
        console.error('Грешка при зареждане на потребителя:', error);
    }
}

async function handleCoach(user) {
    try {
        const disciplines = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/ClubDisciplines/disciplines-by-club/${user.clubID}`);
        populateDropdown('discipline', disciplines, 'disciplineName', 'id');

        const clubUsers = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`);
        populateDropdown('athlete-select', clubUsers, user => `${user.firstName} ${user.lastName}`, 'id');

        let results = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Results`);

        document.getElementById('discipline').addEventListener('change', function () {
            const disciplineId = Number(this.value);
            const selectedAthleteId = Number(document.getElementById('athlete-select').value);
            updateCharts(clubUsers, results, disciplineId, selectedAthleteId);
        });

        document.getElementById('athlete-select').addEventListener('change', function () {
            const selectedAthleteId = Number(this.value);
            const disciplineId = Number(document.getElementById('discipline').value);
            updateCharts(clubUsers, results, disciplineId, selectedAthleteId);
        });
    } catch (error) {
        console.error('Грешка при зареждане на данните:', error);
    }
}

function populateDropdown(elementId, items, textProperty, valueProperty) {
    const select = document.getElementById(elementId);
    if (select) {
        select.innerHTML = '<option value="" disabled selected>Изберете опция</option>';
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueProperty];
            option.textContent = typeof textProperty === 'function' ? textProperty(item) : item[textProperty];
            select.appendChild(option);
        });
    }
}

function updateCharts(users, results, disciplineId, athleteId) {
    if (!athleteId || !disciplineId) {
        console.warn("Моля, изберете състезател и дисциплина.");
        return;
    }

    const athleteResults = results.filter(result => result.userId === athleteId && result.disciplineId === disciplineId);
    const chartLabels = athleteResults.map(result => new Date(result.resultDate).toLocaleDateString());
    const chartData = athleteResults.map(result => result.valueTime);

    const lineCanvas = document.getElementById('lineChart');
    const barCanvas = document.getElementById('barChart');

    if (!lineCanvas || !barCanvas) {
        console.error("Графиките не са намерени в HTML.");
        return;
    }

    const ctxLine = lineCanvas.getContext('2d');
    const ctxBar = barCanvas.getContext('2d');

    if (!ctxLine || !ctxBar) {
        console.error("Грешка при инициализация на контекста за графиките.");
        return;
    }

    if (window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Резултати',
                data: chartData,
                borderColor: 'blue',
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    if (window.myBarChart) window.myBarChart.destroy();
    window.myBarChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Резултати',
                data: chartData,
                backgroundColor: 'green'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    const radarCanvas = document.getElementById('radarChart');

if (!radarCanvas) {
    console.error("Радарната диаграма не е намерена в HTML.");
    return;
}

const ctxRadar = radarCanvas.getContext('2d');
if (!ctxRadar) {
    console.error("Грешка при инициализация на контекста за радарната диаграма.");
    return;
}

// Унищожаваме предишната диаграма, ако има такава
if (window.myRadarChart) window.myRadarChart.destroy();

window.myRadarChart = new Chart(ctxRadar, {
    type: 'radar',
    data: {
        labels: chartLabels,
        datasets: [{
            label: 'Резултати',
            data: chartData,
            backgroundColor: 'rgba(0, 160, 225, 0.3)',
            borderColor: '#00A0E1',
            pointBackgroundColor: '#16314A'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                suggestedMin: Math.min(...chartData) - 5,
                suggestedMax: Math.max(...chartData) + 5
            }
        }
    }
});

}



document.addEventListener('DOMContentLoaded', loadUser);
