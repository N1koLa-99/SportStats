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

        document.getElementById('sort-select').addEventListener('change', async () => {
            const selectedUserId = Number(document.getElementById('athlete-select').value);
            const disciplineId = Number(document.getElementById('discipline').value);

            if (!selectedUserId || !disciplineId) return;

            const selectedUser = clubUsers.find(u => u.id === selectedUserId);
            if (!selectedUser) return;

            const currentYear = new Date().getFullYear();
            const yearOfBirth = currentYear - selectedUser.age;

            try {
                const res = await fetch(`https://sportstatsapi.azurewebsites.net/api/Results/by-user/${selectedUserId}/by-discipline/${disciplineId}`, {
                    headers: { 'Requester-Id': user.id }
                });
                const results = await res.json();

                fetchNormativesAndCompare(disciplineId, yearOfBirth, selectedUser.gender, results, selectedUser);
                updateCharts(results);
            } catch (error) {
                console.error("Грешка при сортиране:", error);
                showMessageBox("Грешка при сортиране!", true);
            }
        });

        // 🔽 Нов eventListener за филтър по басейн
        document.getElementById('pool-select').addEventListener('change', async () => {
            const selectedUserId = Number(document.getElementById('athlete-select').value);
            const disciplineId = Number(document.getElementById('discipline').value);

            if (!selectedUserId || !disciplineId) return;

            const selectedUser = clubUsers.find(u => u.id === selectedUserId);
            if (!selectedUser) return;

            const currentYear = new Date().getFullYear();
            const yearOfBirth = currentYear - selectedUser.age;

            try {
                const res = await fetch(`https://sportstatsapi.azurewebsites.net/api/Results/by-user/${selectedUserId}/by-discipline/${disciplineId}`, {
                    headers: { 'Requester-Id': user.id }
                });
                const results = await res.json();

                fetchNormativesAndCompare(disciplineId, yearOfBirth, selectedUser.gender, results, selectedUser);
                updateCharts(results);
            } catch (error) {
                console.error("Грешка при филтър по басейн:", error);
                showMessageBox("Грешка при филтриране по басейн!", true);
            }
        });

        // 🔍 Нов eventListener за търсене по име
        document.getElementById('search-input').addEventListener('input', () => {
            const searchTerm = document.getElementById('search-input').value.toLowerCase();

            const filteredUsers = clubUsers.filter(u => {
                const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
                return fullName.includes(searchTerm);
            });

            populateDropdown('athlete-select', filteredUsers, u => `${u.firstName} ${u.lastName}`, 'id');
        });

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
    const sortSelect = document.getElementById('sort-select');
    const poolSelect = document.getElementById('pool-select');

    if (!resultsContainer || !normativesContainer) return;

    // 📌 Филтрация по избран тип басейн
    const selectedPool = poolSelect ? poolSelect.value : 'all';
    let filteredResults = [...results];
    if (selectedPool === '25' || selectedPool === '50') {
        filteredResults = filteredResults.filter(r => r.swimmingPoolStandart === Number(selectedPool));
    }

    // 🔃 Сортиране според избора
    const sortOption = sortSelect ? sortSelect.value : 'date-desc';
    const sortedResults = [...filteredResults];

    switch (sortOption) {
        case 'date-asc':
            sortedResults.sort((a, b) => new Date(a.resultDate) - new Date(b.resultDate));
            break;
        case 'date-desc':
            sortedResults.sort((a, b) => new Date(b.resultDate) - new Date(a.resultDate));
            break;
        case 'time-asc':
            sortedResults.sort((a, b) => a.valueTime - b.valueTime);
            break;
        case 'time-desc':
            sortedResults.sort((a, b) => b.valueTime - a.valueTime);
            break;
    }

    // 🧹 Изчистване на предишното съдържание
    resultsContainer.innerHTML = '';
    normativesContainer.innerHTML = '';

    if (sortedResults.length === 0) {
        resultsContainer.innerHTML = 'Няма налични резултати за този атлет.';
        normativesContainer.innerHTML = 'Няма нормативи за сравнение.';
        return;
    }

    const list = document.createElement('ul');

    sortedResults.forEach(result => {
        const poolType = result.swimmingPoolStandart;
        const resultTime = result.valueTime;
        const formattedResultTime = formatTime(resultTime);
        const resultDate = new Date(result.resultDate).toLocaleDateString();
        const location = result.location || 'Няма данни';

        // 📌 Намиране на съответните нормативи
        let matchingNormatives = [];
        if (poolType === 25) {
            matchingNormatives = normatives.filter(n => n.swimmingPoolStandartId === 1);
        } else if (poolType === 50) {
            matchingNormatives = normatives.filter(n => n.swimmingPoolStandartId === 1 || n.swimmingPoolStandartId === 2);
        }

        // 🖋️ Създаване на HTML за резултата
        const resultItem = document.createElement('li');
        resultItem.innerHTML = `
            <strong>${poolType} м басейн - ${resultDate}</strong><br>
            Резултат: ${formattedResultTime} сек<br>
            Локация: ${location}
        `;

        if (matchingNormatives.length === 0) {
            resultItem.innerHTML += `<br>ℹ️ Без съпоставяне с норматив`;
        } else {
            const normList = document.createElement('ul');

            matchingNormatives.forEach(norm => {
                const normativeTime = norm.valueStandart;
                const timeDiff = resultTime - normativeTime;
                const isCovered = timeDiff <= 0;

                const formattedNorm = formatTime(normativeTime);
                const poolLabel = norm.swimmingPoolStandartId === 1 ? '25 м' : '50 м';
                const diffText = formatTime(Math.abs(timeDiff));
                const statusText = isCovered
                    ? `✅ Покрит норматив (${poolLabel}) - разлика: ${diffText} сек`
                    : `❌ Не е покрит норматив (${poolLabel}) - разлика: ${diffText} сек`;
                const color = isCovered ? 'green' : 'red';

                const normItem = document.createElement('li');
                normItem.innerHTML = `<span style="color:${color}">${statusText}</span>`;
                normList.appendChild(normItem);
            });

            resultItem.appendChild(normList);
        }

        list.appendChild(resultItem);
    });

    normativesContainer.appendChild(list);
}

function filterNormativesByPool(result, normatives) {
    if (!result.swimmingPoolStandart) return [];

    const pool = parseInt(result.swimmingPoolStandart);

    return normatives.filter(normative => {
        const normativePool = parseInt(normative.swimmingPoolStandart);

        if (pool === 50) {
            return normativePool === 50 || normativePool === 25;
        } else if (pool === 25) {
            return normativePool === 25;
        }

        return false;
    });
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
                borderColor: '#007bff',
                backgroundColor: '#007bff',
                fill: false,
                tension: 0.3,
                pointRadius: 7,
                pointHoverRadius: 10
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
                        max: Math.max(...chartData) + 5,
                        font: {
                            size: 14 // още по-големи числа по оста Y
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 14 // още по-големи дати по оста X
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 14 },
                    padding: 14,
                    callbacks: {
                        title: function (context) {
                            return `Дата: ${context[0].label}`;
                        },
                        label: function (context) {
                            const index = context.dataIndex;
                            const result = results[index];
                            const value = context.formattedValue;
                            const location = result.location || 'Няма данни';
                            const pool = result.swimmingPoolStandart || 'Няма данни';
                            return [
                                `Резултат: ${value} сек`,
                                `Локация: ${location}`,
                                `Басейн: ${pool} м`
                            ];
                        }
                    }
                },
                legend: {
                    labels: {
                        font: {
                            size: 14
                        }
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
document.getElementById('sort-select').addEventListener('change', () => {
    const selectedUserId = Number(document.getElementById('athlete-select').value);
    const disciplineId = Number(document.getElementById('discipline').value);

    // ⛔ Ако не е избран състезател или дисциплина – не правим нищо
    if (!selectedUserId || !disciplineId || !clubUsers || !user) return;

    const selectedUser = clubUsers.find(u => u.id === selectedUserId);
    if (!selectedUser) return;

    const currentYear = new Date().getFullYear();
    const yearOfBirth = currentYear - selectedUser.age;

    fetch(`https://sportstatsapi.azurewebsites.net/api/Results/by-user/${selectedUserId}/by-discipline/${disciplineId}`, {
        headers: { 'Requester-Id': user.id }
    })
    .then(res => res.json())
    .then(results => {
        fetchNormativesAndCompare(disciplineId, yearOfBirth, selectedUser.gender, results, selectedUser);
    });
});
document.addEventListener('DOMContentLoaded', function () {
    const lineCanvas = document.getElementById('lineChart');
    if (!lineCanvas) {
        console.error("Не е намерено платно за диаграмата.");
        return;
    }
    
    loadUser(); 
});
document.getElementById('pool-select').addEventListener('change', fetchAndDisplayResults);
