document.addEventListener("DOMContentLoaded", async () => {
    let chart = null;
    const userJson = localStorage.getItem('user');
    const savedHash = localStorage.getItem('userHash');

    if (!userJson || !savedHash) {
        redirectToIndex("Невалидни данни. Пренасочване към началната страница.");
        return;
    }
    const user = JSON.parse(userJson);  
    async function hashUserData(user) {
        const data = `${user.firstName}${user.lastName}${user.email}${user.gender}${user.roleID}${user.clubID}${user.profileImage_url}${user.id}${user.yearOfBirth}${user.statusID}`;
        const encoder = new TextEncoder();
        const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
        
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }
    try {
        const currentHash = await hashUserData(user);
        if (currentHash !== savedHash) {
            redirectToIndex("Не бъди злонамерен <3");
            return;
        }

    } catch (error) {
        console.error("Грешка при хеширането:", error);
        redirectToIndex("Възникна грешка. Пренасочване...");
    }
function redirectToIndex(message) {
        alert(message);
        localStorage.clear();
        window.location.href = "Index.html";
}

async function checkUserStatus() {
        try {
            const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/${user.id}`);
            if (!response.ok) throw new Error("Грешка при извличане на статуса");
            
            const updatedUser = await response.json();
            if (user.statusID !== updatedUser.statusID) {
                alert("Вашият статус е променен. Моля, влезте отново.Чрез имейл и парола");
                localStorage.clear();
                window.location.href = "Index.html";
            }
        } catch (error) {
            console.error("Грешка при проверка на статуса:", error);
        }
}
    setInterval(checkUserStatus, 8000);
    checkUserStatus();

function renderUserInterface(user) {
 if (user.statusID === 1 || user.statusID === 3) {
            document.body.innerHTML = `
                <div class="status-container" style="text-align: center; padding: 30px; background-color: white; border-radius: 15px; width: 50%; margin: 50px auto; box-shadow: 0px 5px 10px rgba(0, 0, 0, 0.2); font-family: Arial, sans-serif;">
                    <img src="https://sportstats.blob.core.windows.net/$web/SportStats.png" alt="SportStats Logo" style="width: 150px; margin-bottom: 20px;">
                    <h2 style="color: #2c3e50; font-size: 24px;">${user.statusID === 1 ? "Вашата заявка е в процес на одобрение." : "Вашата заявка е отхвърлена."}</h2>
                    <p style="color: #555; font-size: 18px;">${user.statusID === 1 ? "Моля, изчакайте одобрение от администратора." : "Можете да изберете друг клуб."}</p>
                    ${user.statusID === 3 || user.statusID === 1 ? '<button id="change-club-button" style="padding: 12px 25px; border: none; background-color: #ff9800; color: white; border-radius: 8px; cursor: pointer; font-size: 16px;">Смени клуба</button>' : ''}
                </div>
            `;
            if (user.statusID === 3 || user.statusID === 1) {
                document.getElementById('change-club-button').addEventListener('click', loadClubs);
            }
        }
}

async function loadClubs() {
        try {
            const response = await fetch('https://sportstatsapi.azurewebsites.net/api/Clubs');
            if (!response.ok) throw new Error("Грешка при зареждане на клубовете.");
            
            const clubs = await response.json();
            document.body.innerHTML = `
                <div class="club-selection-container" style="text-align: center; padding: 30px; background-color: white; border-radius: 15px; width: 50%; margin: 50px auto; box-shadow: 0px 5px 10px rgba(0, 0, 0, 0.2); font-family: Arial, sans-serif;">
                    <h2 style="color: #2c3e50; font-size: 22px;">Изберете нов клуб</h2>
                    <select id="club-select" style="padding: 10px;width: 80%;margin: 10px 0;color: black;border-color: orange;">
                        <option value="" disabled selected>Изберете клуб...</option>
                        ${clubs.map(club => `<option value="${club.id}">${club.name}</option>`).join('')}
                    </select>
                    <button id="confirm-change-club" style="padding: 10px 20px; border: none; background-color: #ff9800; color: white; border-radius: 8px; cursor: pointer; font-size: 16px;">Потвърди</button>
                </div>
            `;
            document.getElementById('confirm-change-club').addEventListener('click', async function () {
                const selectedClubId = document.getElementById('club-select').value;
                if (!selectedClubId) {
                    alert("Моля, изберете клуб.");
                    return;
                }
                const selectedClubName = document.getElementById('club-select').selectedOptions[0].textContent;
                const isConfirmed = confirm(`Сигурни ли сте, че искате да се присъедините към клуб "${selectedClubName}"?`);
                if (isConfirmed) {
                    await changeUserClub(user.id, selectedClubId);
                }
            });
        } catch (error) {
            console.error("Грешка:", error);
            alert("Неуспешно зареждане на клубовете.");
        }
}

async function changeUserClub(userId, newClubId) {
        try {
            const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/users/${userId}/requestJoin/${newClubId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) {
                const errorMessage = await response.text();
                console.error("Грешка при изпращане на заявката за присъединяване:", errorMessage);
                alert(`Грешка: ${errorMessage}`);
                return;
            }
            alert("Заявката за присъединяване е изпратена успешно. Очаква се одобрение.");
            user.clubID = newClubId;
            user.statusID = 1;
            localStorage.setItem('user', JSON.stringify(user));
            renderUserInterface(user);
        } catch (error) {
            console.error("Грешка при смяната на клуба:", error);
            alert("Възникна грешка при смяната на клуба.");
        }
}
    renderUserInterface(user);
    if (user) {
        document.getElementById('first-name').textContent = user.firstName || 'Няма данни';
        document.getElementById('last-name').textContent = user.lastName || 'Няма данни';
        document.getElementById('year-of-birth').textContent = user.yearOfBirth || 'Няма данни';
    

        if (user.roleID === 2) {
            const coachButton = document.getElementById('coach-button');
            coachButton.classList.remove('hidden');
    
            coachButton.addEventListener('click', function () {
                window.location.href = 'CoacherPage.html';
            });
    
            // Показваме и бутона за заявките
            const statusButton = document.getElementById('status-button');
            statusButton.classList.remove('hidden');
    
            statusButton.addEventListener('click', function () {
                window.location.href = 'Status.html';
            });
        } else {
            document.getElementById('coach-button').classList.add('hidden');
            document.getElementById('status-button').classList.add('hidden');
        }

        fetch(`https://sportstatsapi.azurewebsites.net/api/Clubs/${user.clubID}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(club => {
                document.getElementById('club').textContent = club.name || 'Няма данни';
                fetchDisciplinesByClubId(user.clubID);
            })
            .catch(error => {
                console.error('Грешка при извличане на информация за клуба:', error);
                document.getElementById('club').textContent = 'Грешка при зареждане на клуба';
            });

        document.getElementById('discipline').addEventListener('change', function () {
            const disciplineId = parseInt(this.value, 10);
            if (disciplineId) {
                fetchResults(disciplineId, user.id);
            }
        });

        
        if (user.id > 0) {
            fetch(`https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${user.id}`)
                .then(response => {
                    if (!response.ok) {
                        console.error('Неуспешно зареждане на профилната снимка:', response.status, response.statusText);
                        throw new Error('Неуспешно зареждане на профилната снимка');
                    }
                    return response.blob();
                })
                .then(imageBlob => {
                    const imageUrl = URL.createObjectURL(imageBlob);
                    document.getElementById('profile-picture').src = imageUrl;
                })
                .catch(error => {
                    console.error('Грешка при зареждане на профилната снимка:', error);
                    document.getElementById('profile-picture').src = 'https://sportstats.blob.core.windows.net/$web/ProfilePhoto2.jpg';
                    document.getElementById('profile-picture').alt = 'Профилната снимка не е налична';
                });
        } else {
            console.warn('Невалиден user.id:', user ? user.id : 'user не е дефиниран');
            document.getElementById('profile-picture').src = 'https://sportstats.blob.core.windows.net/$web/ProfilePhoto2.jpg';
            document.getElementById('profile-picture').alt = 'Профилната снимка не е налична';
        }
    }
    
let currentClubId = null;
function fetchDisciplinesByClubId(clubId) {
    currentClubId = clubId;

    fetch(`https://sportstatsapi.azurewebsites.net/api/ClubDisciplines/disciplines-by-club/${clubId}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(disciplines => {
            populateDisciplineDropdown(disciplines);
        })
        .catch(error => {
            console.error('Грешка при извличане на дисциплините на клуба:', error);
        });
}

let disciplineSelectInitialized = false;
function populateDisciplineDropdown(disciplines) {
    const disciplineSelect = document.getElementById('discipline');
    disciplineSelect.innerHTML = '<option value="" disabled selected>Дисциплина</option>';

    disciplines.forEach(discipline => {
        const option = document.createElement('option');
        option.value = discipline.id;
        option.textContent = discipline.disciplineName || `Дисциплина ${discipline.id} (Без име)`;
        disciplineSelect.appendChild(option);
    });

    if (!disciplineSelectInitialized) {
        disciplineSelect.addEventListener('change', function () {
            const selectedDisciplineId = this.value;

            if (currentClubId && selectedDisciplineId) {
                fetchBestResultsByDisciplineInClub(currentClubId, selectedDisciplineId);
                fetchBestClubByDiscipline(selectedDisciplineId);
            }
        });
        disciplineSelectInitialized = true;
    }
}

function fetchResults(disciplineId, userId) {
    const userString = localStorage.getItem('user');
    let user;

    try {
        user = JSON.parse(userString);
    } catch (err) {
        console.error('Грешка при парсване на потребителя от localStorage.', err);
    }

    if (!disciplineId || !userId || !user || !user.id || !user.yearOfBirth || !user.gender) {
        console.error('Липсват данни: disciplineId, userId или потребителската информация.');
        return;
    }

    if (user.id !== userId) {
        alert('Нямате права да виждате тези резултати!');
        return;
    }

    const NO_RESULTS_MESSAGE = 'Няма налични резултати.';

    function displayNoResults() {
        document.getElementById('best-result').textContent = NO_RESULTS_MESSAGE;
        document.getElementById('latest-result').textContent = NO_RESULTS_MESSAGE;
        document.getElementById('normative-difference').textContent = '';
        document.getElementById('normative-value').innerHTML = '';

        const chartCanvas = document.getElementById('resultsChart');
        if (chartCanvas && chart) {
            chart.destroy();
        }
    }

    document.getElementById('best-result').textContent = 'Зареждане...';
    document.getElementById('latest-result').textContent = 'Зареждане...';

    fetch(`https://sportstatsapi.azurewebsites.net/api/Results/by-user/${userId}/by-discipline/${disciplineId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Requester-Id': user.id
        }
    })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(results => {
            if (!Array.isArray(results) || results.length === 0) {
                displayNoResults();
                return;
            }

            fetchNormativesAndDisplayResults(disciplineId, user.yearOfBirth, user.gender, results);
        })
        .catch(error => {
            console.error('Грешка при извличане на резултатите:', error);
            displayNoResults();
        });
}

function fetchNormativesAndDisplayResults(disciplineId, yearOfBirth, userGender, results) {
    if (disciplineId === 18) {
        displayResults(disciplineId, yearOfBirth, userGender, results, []);
        return;
    }

    fetch(`https://sportstatsapi.azurewebsites.net/api/Normatives/discipline/${disciplineId}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(normatives => {
            const genderMapping = { 'male': 'M', 'female': 'F' };
            const mappedGender = genderMapping[userGender.toLowerCase()] || userGender;

            const relevantNormatives = normatives.filter(normative => {
                return (
                    yearOfBirth >= normative.minYearOfBorn &&
                    yearOfBirth <= normative.maxYearOfBorn &&
                    normative.gender === mappedGender
                );
            });

            displayResults(disciplineId, yearOfBirth, mappedGender, results, relevantNormatives);
        })
        .catch(error => {
            console.error('Грешка при извличане на нормативите:', error);
            displayResults(disciplineId, yearOfBirth, userGender, results, []);
        });
}

function mapPoolLengthToId(length) {
    if (length === 25) return 1;
    if (length === 50) return 2;
    return 0;
}


function fetchBestResultsByDisciplineInClub(clubId, disciplineId) {
    fetch(`https://sportstatsapi.azurewebsites.net/api/results/by-club/${clubId}/by-discipline/${disciplineId}`)
        .then(response => {
            if (!response.ok) throw new Error("Грешка при извличане на резултатите");
            return response.json();
        })
        .then(results => {
            const tbody = document.querySelector("#users-table tbody");
            tbody.innerHTML = "";

            if (!results || results.length === 0) {
                const row = document.createElement("tr");
                row.innerHTML = `<td colspan="4" style="text-align:center;">Няма налични резултати за тази дисциплина.</td>`;
                tbody.appendChild(row);
                return;
            }

            const unit = getUnitForDiscipline(Number(disciplineId));

            results.forEach((result, index) => {
                const displayValue = formatResultValue(result.valueTime, unit);
                let medalIcon = "";
                let rowClass = "";

                switch (index) {
                    case 0:
                        medalIcon = "🥇";
                        rowClass = "first-place";
                        break;
                    case 1:
                        medalIcon = "🥈";
                        rowClass = "second-place";
                        break;
                    case 2:
                        medalIcon = "🥉";
                        rowClass = "third-place";
                        break;
                }

                const row = document.createElement("tr");
                row.className = rowClass;
                row.innerHTML = `
                    <td>${medalIcon} ${result.userFirstName} ${result.userLastName}</td>
                    <td>${result.userYearOfBirth}</td>
                    <td>${displayValue}</td>
                `;
                tbody.appendChild(row);
            });
        })
        .catch(error => {
            console.error("Грешка при зареждане на резултатите:", error);
        });
}
function fetchBestClubByDiscipline(disciplineId, yearOfBirth) {
    fetch(`https://sportstatsapi.azurewebsites.net/api/Results/best-club-by-discipline/${disciplineId}/year/${user.yearOfBirth}`)
        .then(response => {
            if (!response.ok) throw new Error('Неуспешно извличане на резултати');
            return response.json();
        })
        .then(data => {
            populateBestClubTable([data], disciplineId);
        })
        .catch(error => {
            console.error('Грешка при зареждане на най-добър клуб:', error);
        });
}

function populateBestClubTable(data, disciplineId) {
    const tbody = document.querySelector('#best-club-table tbody');
    tbody.innerHTML = '';

    if (!Array.isArray(data)) {
        console.warn('Очаква се масив, но получено:', data);
        return;
    }

    const unit = getUnitForDiscipline(disciplineId);

    const sortedResults = [...data].sort((a, b) => {
        return (a.bestResult?.valueTime || 0) - (b.bestResult?.valueTime || 0);
    });

    sortedResults.forEach((entry, index) => {
        const { ageGroup, bestResult } = entry;

        if (!bestResult || bestResult.valueTime === undefined) {
            console.warn('Липсващ или невалиден bestResult:', bestResult);
            return;
        }

        const formattedValue = formatResultValue(bestResult.valueTime, unit);

        const row = document.createElement('tr');
        let rowClass = '';
        let medalEmoji = '';

        switch (index) {
            case 0:
                rowClass = 'gold-row'; medalEmoji = '🥇'; break;
            case 1:
                rowClass = 'silver-row'; medalEmoji = '🥈'; break;
            case 2:
                rowClass = 'bronze-row'; medalEmoji = '🥉'; break;
        }

        row.classList.add('best-club-row', rowClass);

        row.innerHTML = `
            <td>${ageGroup}</td>
            <td>${medalEmoji} ${bestResult.clubName}</td>
            <td>${formattedValue}</td>
        `;

        row.addEventListener('mouseenter', () => {
            const hoverDiv = document.getElementById('hover-info');
            hoverDiv.style.display = 'block';
            hoverDiv.innerHTML = `
                <strong>Състезател:</strong> ${bestResult.userFirstName} ${bestResult.userLastName}<br>
                <strong>Роден:</strong> ${bestResult.yearOfBirth}<br>
                <strong>Дата:</strong> ${new Date(bestResult.resultDate).toLocaleDateString()}<br>
                <strong>Локация:</strong> ${bestResult.location}
            `;
            const rect = row.getBoundingClientRect();
            hoverDiv.style.top = `${rect.bottom + window.scrollY}px`;
            hoverDiv.style.left = `${rect.left}px`;
            hoverDiv.style.position = 'absolute';
            hoverDiv.style.backgroundColor = '#2d3748';
            hoverDiv.style.border = '1px solid #ccc';
            hoverDiv.style.color = '#fff';
            hoverDiv.style.padding = '10px';
            hoverDiv.style.borderRadius = '8px';
            hoverDiv.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            hoverDiv.style.zIndex = 1000;
        });

        row.addEventListener('mouseleave', () => {
            const hoverDiv = document.getElementById('hover-info');
            hoverDiv.style.display = 'none';
        });

        tbody.appendChild(row);
    });
}



function displayResults(disciplineId, yearOfBirth, userGender, results, normatives) {
    results = results.map(result => ({
        ...result,
        swimmingPoolStandartId: mapPoolLengthToId(result.swimmingPoolStandart),
    }));

    const isTimeDiscipline = disciplineId !== 18; // само дисциплина 18 е с "по-голямото е по-добро"

    // Сортиране по дата (най-новите първи)
   const sortedResults = [...results].sort((a, b) => new Date(b.resultDate) - new Date(a.resultDate));
const latestResult = sortedResults[0]; // Най-нов по дата
const oldestResult = sortedResults[sortedResults.length - 1]; // Най-стар по дата


    function findBestResult(results, isTimeDiscipline) {
        return results.reduce((best, result) => {
            return isTimeDiscipline
                ? result.valueTime < best.valueTime ? result : best
                : result.valueTime > best.valueTime ? result : best;
        }, results[0]);
    }

    const normative25 = normatives.find(n => n.swimmingPoolStandartId === 1);
    const normative50 = normatives.find(n => n.swimmingPoolStandartId === 2);

    function compareToNormative(normative, poolLabel, resultOverride = null) {
        const poolId = normative.swimmingPoolStandartId;
        const resultToUse = resultOverride || findBestResult(
            results.filter(r => r.swimmingPoolStandartId === poolId),
            isTimeDiscipline
        );

        if (!resultToUse) {
            return `
            <div style="border: 1px solid #eee; padding: 12px; margin-bottom: 16px; border-radius: 8px; background-color: #f9f9f9;">
                <div style="font-weight: 600;">${poolLabel}</div>
                <div>Няма резултати за сравнение с този норматив.</div>
            </div>`;
        }

        const diff = isTimeDiscipline
            ? resultToUse.valueTime - normative.valueStandart
            : normative.valueStandart - resultToUse.valueTime;

        const isSuccess = diff <= 0;
        const formattedDiff = formatDifference(diff, getUnitForDiscipline(disciplineId));
        return `
        <div style="
            background-color: ${isSuccess ? '#e9f6ec' : '#fce9e9'};
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
            margin-right: 20px;
            font-family: 'Segoe UI', sans-serif;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 13px;
            max-width: 100%;
            box-sizing: border-box;
            border: 1px solid #eee;
        ">
            <div style="font-weight: 600; color: #1f1f1f; font-size: 15px;">
                ${poolLabel}
            </div>
            <div><strong>Норматив БФПС:</strong><br> ${formatTime(normative.valueStandart)}</div>
            <div style="color: ${isSuccess ? '#198330' : '#bd1818'};">
                <strong>Разлика:</strong> ${formattedDiff}
            </div>
            <div style="
                background-color: ${isSuccess ? '#b6e1c1' : '#f2b3b3'};
                color: #000;
                font-weight: 600;
                padding: 4px 8px;
                border-radius: 4px;
                display: inline-block;
            ">
                ${isSuccess ? '✅ Покрит норматив' : '❌ Непокрит норматив'}
            </div>
        </div>`;
    }

    const bestOverall = findBestResult(results, isTimeDiscipline);

    let normativeValueText = '';

    if (disciplineId !== 18) {
        if (normative25) {
            const candidate = findBestResult(results.filter(r =>
                [1, 2].includes(r.swimmingPoolStandartId) &&
                r.valueTime <= normative25.valueStandart
            ), isTimeDiscipline);

            if (candidate) {
                normativeValueText += compareToNormative(normative25, '25м басейн', candidate);
            } else {
                normativeValueText += compareToNormative(normative25, '25м басейн');
            }
        }

        if (normative50) {
            const best50 = results.find(r => r.swimmingPoolStandartId === 2);
            if (best50) {
                normativeValueText += compareToNormative(normative50, '50м басейн');
            } else {
                normativeValueText += `
                <div style="border: 1px solid #eee; padding: 12px; margin-bottom: 16px; border-radius: 8px; background-color: #f9f9f9;">
                    <div style="font-weight: 600;">50м басейн</div>
                    <div>Няма резултати за сравнение с този норматив.</div>
                </div>`;
            }
        }

        if (!normative25 && !normative50) {
            normativeValueText = 'Няма норматив за тази възрастова група и дисциплина.';
        }
    } else {
        normativeValueText = '<div style="padding: 8px; color: #777;">Няма норматив за тази дисциплина.</div>';
    }

    const chartLabels = sortedResults.map(result => new Date(result.resultDate).toLocaleDateString());
    const chartData = sortedResults.map(result => result.valueTime);
    const chartNormative25m = chartLabels.map(() => normative25?.valueStandart ?? null);
    const chartNormative50m = chartLabels.map(() => normative50?.valueStandart ?? null);

    const ctx = document.getElementById('resultsChart')?.getContext('2d');
    if (ctx) {
        if (chart) chart.destroy();

        const latestDataCount = 8;
        const latestLabels = chartLabels.slice(-latestDataCount);
        const latestChartData = chartData.slice(-latestDataCount);
        const latestChartNormative25m = chartNormative25m.slice(-latestDataCount);
        const latestChartNormative50m = chartNormative50m.slice(-latestDataCount);

        const gradientLine1 = ctx.createLinearGradient(0, 0, 0, 400);
        gradientLine1.addColorStop(0, 'rgba(75, 192, 192, 0.8)');
        gradientLine1.addColorStop(1, 'rgba(75, 192, 192, 0.4)');

        const gradientLine2 = ctx.createLinearGradient(0, 0, 0, 400);
        gradientLine2.addColorStop(0, 'rgba(255, 99, 132, 0.8)');
        gradientLine2.addColorStop(1, 'rgba(255, 99, 132, 0.4)');

        const gradientLine3 = ctx.createLinearGradient(0, 0, 0, 400);
        gradientLine3.addColorStop(0, 'rgba(54, 162, 235, 0.8)');
        gradientLine3.addColorStop(1, 'rgba(54, 162, 235, 0.4)');

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: latestLabels,
                datasets: [
                    {
                        label: 'Резултати',
                        data: latestChartData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: gradientLine1,
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                        pointHoverBackgroundColor: 'rgba(75, 192, 192, 0.8)',
                        pointStyle: 'rectRounded',
                    },
                    {
                        label: 'Норматив 25m',
                        data: latestChartNormative25m,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: gradientLine2,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                    },
                    {
                        label: 'Норматив 50m',
                        data: latestChartNormative50m,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: gradientLine3,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'nearest', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: 'Arial', size: 14 },
                            padding: 20,
                            boxWidth: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { weight: 'bold', size: 14 },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function(context) {
                                const index = context.dataIndex;
                                const result = sortedResults[index];
                                const value = result.valueTime;
                                const formattedValue = isTimeDiscipline ? formatTime(value) : `${value} ${getUnitForDiscipline(disciplineId)}`;
                                const formattedDate = new Date(result.resultDate).toLocaleDateString('bg-BG');
                                const location = result.location || "Няма информация";
                                const poolLength = result.swimmingPoolStandart + " м";

                                if (context.dataset.label.includes("Норматив")) {
                                    return ` Норматив (${poolLength}): ${formatTime(context.parsed.y)}`;
                                } else {
                                    return [
                                        ` Дата: ${formattedDate}`,
                                        "",
                                        ` Резултат: ${formattedValue}`,
                                        "",
                                        ` Локация: ${location}`,
                                        "",
                                        ` Басейн: ${poolLength}`
                                    ];
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: { display: false },
                    y: {
                        title: {
                            display: true,
                            text: getUnitForDiscipline(disciplineId),
                            font: { size: 16, weight: 'bold' }
                        },
                        beginAtZero: !isTimeDiscipline,
                        reverse: isTimeDiscipline,
                        ticks: {
                            autoSkip: true,
                            maxTicksLimit: 8,
                            callback: function(value) {
                                return isTimeDiscipline ? formatTime(value) : `${value} ${getUnitForDiscipline(disciplineId)}`;
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            lineWidth: 1
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutElastic',
                }
            }
        });
    }

    document.getElementById('best-result').textContent = bestOverall 
        ? `Най-добър резултат: ${formatResultValue(bestOverall.valueTime, getUnitForDiscipline(disciplineId))}` 
        : 'Няма налични резултати.';

    document.getElementById('latest-result').textContent = oldestResult 
        ? `Последен резултат: ${formatResultValue(oldestResult.valueTime, getUnitForDiscipline(disciplineId))}` 
        : 'Няма налични резултати.';

    document.getElementById('normative-difference').innerHTML = '';
    document.getElementById('normative-value').innerHTML = normativeValueText;
}


    const disciplineSelect = document.getElementById("discipline");
    const chartContainer = document.getElementById("chart-container");

    disciplineSelect.addEventListener("change", function () {
        if (disciplineSelect.value) {
            chartContainer.style.display = "block"; // Показва графиката
        } else {
            chartContainer.style.display = "none"; // Скрива графиката
        }
    });




function formatTime(seconds) {

    if (seconds === undefined || seconds === null || isNaN(seconds)) {
        console.warn('Некоректна стойност за време');
        return 'Неизвестна стойност';
    }

    if (seconds < 1) {
        const millis = Math.round(seconds * 100).toString().padStart(2, '0');
        return `${millis}ст`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.round((seconds % 1) * 100).toString().padStart(2, '0');

    let timeString = '';
    if (hours > 0) timeString += `${hours} : `;
    if (minutes > 0 || hours > 0) timeString += `${minutes}мин `;
    if (secs > 0 || minutes > 0 || hours > 0) timeString += `${secs}сек `;
    if (millis > 0 || (seconds % 1 !== 0)) timeString += `${millis}ст `;

    return timeString.trim();
}


function getUnitForDiscipline(disciplineId) {
    disciplineId = Number(disciplineId); // ✅ гарантира сравнение по число

    const timeDisciplines = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
    const distanceDisciplines = [18];

    if (timeDisciplines.includes(disciplineId)) return 'време';
    if (distanceDisciplines.includes(disciplineId)) return 'метра';
    return '';
}



function formatResultValue(value, unit) {

    if (value === null || value === undefined || isNaN(Number(value))) {
        console.warn('Невалидна стойност за резултат');
        return 'Няма данни';
    }

    if (unit === 'време') {
        return formatTime(Number(value));
    } else if (unit === 'метра') {
        return `${Number(value).toFixed(2)} м`;
    } else {
        return value;
    }
}




function formatDifference(diff, unit) {
    const sign = diff > 0 ? '+' : '-';
    if (unit === 'време') {
        return `${sign}${formatTime(Math.abs(diff))}`;
    }
    return `${sign}${diff.toFixed(2)} м`;
}

});