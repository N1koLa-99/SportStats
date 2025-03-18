async function fetchJson(url) {
    const response = await fetch(url);
    return response.json();
}

async function hashUserData(user) {
    const data = `${user.firstName}${user.lastName}${user.email}${user.gender}${user.roleID}${user.clubID}${user.profileImage_url}${user.id}${user.yearOfBirth}${user.statusID}`;
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

async function loadUser() {
    try {
        let storedUser = localStorage.getItem('user');
        const savedHash = localStorage.getItem('userHash');

        if (!storedUser || !savedHash) {
            alert('Няма достъп до тази страница.');
            window.location.href = 'HomePage.html';
            return;
        }

        let user = JSON.parse(storedUser);
        const currentHash = await hashUserData(user);

        if (currentHash !== savedHash) {
            alert('Не бъди злонамерен <3');
            localStorage.clear();
            window.location.href = 'Index.html';
            return;
        }

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


async function handleCoach(user) {
    try {

        const disciplines = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/ClubDisciplines/disciplines-by-club/${user.clubID}`);
        populateDropdown('discipline', disciplines, 'disciplineName', 'id');

        const clubUsers = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`);
        populateDropdown('athlete-select', clubUsers, user => `${user.firstName} ${user.lastName}`, 'id');

        async function fetchAndDisplayResults() {
            resetResults();

            const selectedUserId = Number(document.getElementById('athlete-select').value);
            const disciplineId = Number(document.getElementById('discipline').value);

            if (selectedUserId && disciplineId) {
                try {
                    const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Results/by-user/${selectedUserId}/by-discipline/${disciplineId}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Requester-Id': user.id 
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`Грешка: ${response.status} - ${response.statusText}`);
                    }

                    const userResults = await response.json();
                    const selectedUser = clubUsers.find(u => u.id === selectedUserId);

                    displayUserInfo(selectedUser);

                    const currentYear = new Date().getFullYear();
                    const yearOfBirth = currentYear - selectedUser.age;

                    fetchNormativesAndCompare(disciplineId, yearOfBirth, selectedUser.gender, userResults, selectedUser);
                    updateCharts(userResults);
                } catch (error) {
                    console.error("Грешка при зареждане на резултатите:", error);
                    showMessageBox("Грешка при зареждане на резултатите!", true);
                }
            }
        }

        document.getElementById('discipline').addEventListener('change', fetchAndDisplayResults);
        document.getElementById('athlete-select').addEventListener('change', fetchAndDisplayResults);

    } catch (error) {
        console.error('Грешка при зареждане на данните:', error);
        showMessageBox("Грешка при зареждане на данните!", true);
    }
}


function resetResults() {

    document.getElementById('best-result').textContent = 'Най-добрият резултат: —';
    const lineCanvas = document.getElementById('lineChart');
    if (window.myChart) {
        window.myChart.destroy();
    }
}
function displayResults(disciplineId, yearOfBirth, gender, results, normatives) {
    const resultsContainer = document.getElementById('results-container');
    const normativesContainer = document.getElementById('normatives-container');

    if (!resultsContainer) {
        console.error('Грешка: Не може да се намери контейнера за резултати.');
        return;
    }

    if (!normativesContainer) {
        console.error('Грешка: Не може да се намери контейнера за нормативи.');
        return;
    }

    resultsContainer.innerHTML = '';
    normativesContainer.innerHTML = '';

    let bestResult = null;
    if (results.length > 0) {
        bestResult = Math.min(...results.map(result => result.valueTime));
        resultsContainer.innerHTML = `Най-добрият резултат: ${formatTime(bestResult)} сек`;
    } else {
        resultsContainer.innerHTML = 'Няма налични резултати за този атлет.';
    }

    if (normatives.length > 0) {
        const list = document.createElement('ul');
        normatives.forEach(normative => {
            const poolType = normative.swimmingPoolStandartId === 1 ? '25m' : '50m';
            const genderText = normative.gender === 'M' ? 'Мъже' : 'Жени'; 
            const formattedTime = formatTime(normative.valueStandart);

            const timeDifference = bestResult - normative.valueStandart;

            const isNormativeCovered = timeDifference <= 0;
            const resultText = isNormativeCovered
                ? `Нормативът е покрит! Разлика: ${formatTime(Math.abs(timeDifference))} сек.`
                : `Нормативът не е покрит! Разлика: ${formatTime(Math.abs(timeDifference))} сек.`;

            const resultTextColor = isNormativeCovered ? 'green' : 'red';

            const item = document.createElement('li');
            item.innerHTML = `${genderText} - ${normative.minYearOfBorn} до ${normative.maxYearOfBorn} години, норматив: ${formattedTime} сек (${poolType}) <br> <span style="color: ${resultTextColor};">${resultText}</span>`;
            list.appendChild(item);
        });
        normativesContainer.appendChild(list);
    } else {
        normativesContainer.innerHTML = 'Няма налични нормативи за тази възрастова група и дисциплина.';
    }
}

function fetchNormativesAndCompare(disciplineId, yearOfBirth, userGender, results, selectedUser) {
    fetch(`https://sportstatsapi.azurewebsites.net/api/Normatives/discipline/${disciplineId}`)
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(normatives => {
        console.log('Получени нормативи:', normatives);

        const genderMapping = { 'male': 'M', 'female': 'F' };
        const mappedGender = genderMapping[userGender.toLowerCase()] || userGender.toUpperCase();
        
        console.log('Година на раждане:', selectedUser.yearOfBirth);
        console.log('Избрания пол:', mappedGender);
        console.log('Всички нормативи:', normatives);
        
        const relevantNormatives = normatives.filter(normative => {
            return (
                selectedUser.yearOfBirth >= normative.minYearOfBorn && 
                selectedUser.yearOfBirth <= normative.maxYearOfBorn && 
                normative.gender === mappedGender 
            );
        });
        
        console.log('Филтрирани нормативи:', relevantNormatives);

        if (relevantNormatives.length === 0) {
            console.log('Няма подходящи нормативи за тази възрастова група и пол.');
        } else {
            console.log('Филтрирани нормативи:', relevantNormatives);
        }

        displayResults(disciplineId, yearOfBirth, mappedGender, results, relevantNormatives);
    })
    .catch(error => {
        console.error('Грешка при извличане на нормативите:', error);
        displayResults(disciplineId, yearOfBirth, userGender, results, []); 
    });
}
function displayNormativesInHTML(normatives) {
    const container = document.getElementById('normatives-container');
    container.innerHTML = ''; 

    if (normatives.length > 0) {
        const list = document.createElement('ul');
        normatives.forEach(normative => {
            const item = document.createElement('li');
            item.innerHTML = `${normative.gender === 'M' ? 'Мъжки' : 'Женски'} - ${normative.minYearOfBorn} до ${normative.maxYearOfBorn} години, норматив: ${formatTime(normative.valueStandart)} сек`;
            list.appendChild(item);
        });
        container.appendChild(list);
    } else {
        container.innerHTML = 'Няма налични нормативи за тази възрастова група и дисциплина.';
    }
}

function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(2); 


    const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const formattedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;


    return `${formattedMinutes}:${formattedSeconds}`;
}


function updateCharts(results) {
    if (!results || results.length === 0) {
        console.warn("Няма данни за диаграмата.");
        return;
    }

    const chartLabels = results.map(result => new Date(result.resultDate).toLocaleDateString());
    const chartData = results.map(result => result.valueTime);

    const bestResult = Math.min(...chartData);
    document.getElementById('best-result').textContent = `Най-добрият резултат: ${bestResult} сек`;

    const lineCanvas = document.getElementById('lineChart');

    if (!lineCanvas) {
        console.error("Грешка: Не е намерено платно за диаграмата.");
        return;
    }

    const ctxLine = lineCanvas.getContext('2d');

    if (!ctxLine) {
        console.error("Грешка: Неуспешна инициализация на контекста на диаграмата.");
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
            maintainAspectRatio: false,
            scales: {
                y: {
                    reverse: true,  
                    ticks: {
                        beginAtZero: false,
                        min: Math.min(...chartData) - 5,
                        max: Math.max(...chartData) + 5
                    }
                }
            }
        }
    });
}

function displayUserInfo(user) {
    const userInfoContainer = document.getElementById('user-info');
    const profilePicture = document.getElementById('profile-picture');
    const userName = document.getElementById('user-name');
    const userBirthDate = document.getElementById('user-birthdate');

    userInfoContainer.style.display = 'block';

    profilePicture.src = `https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${user.id}`;

    userName.textContent = `${user.firstName} ${user.lastName}`;

    userBirthDate.textContent = `Година на раждане: ${user.yearOfBirth}`;
}

document.addEventListener('DOMContentLoaded', function () {
    const lineCanvas = document.getElementById('lineChart');
    if (!lineCanvas) {
        console.error("Не е намерено платно за диаграмата.");
        return;
    }
    
    loadUser(); 
});