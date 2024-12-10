document.addEventListener('DOMContentLoaded', async function () { // Маркираме функцията като async
    let chart; // Глобална променлива за диаграмата
    
    const user = JSON.parse(localStorage.getItem('user'));
    const savedHash = localStorage.getItem('userHash');

    if (!user || !savedHash) {
        alert('Невалидни данни. Пренасочване към началната страница.');
        window.location.href = 'Index.html';
        return;
    }

    // Функция за генериране на хеш
    async function hashUserData(user) {
        const data = `${user.firstName}${user.lastName}${user.age}${user.email}${user.gender}${user.roleID}${user.clubID}${user.profileImage_url}${user.id}`;
        const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    try {
        const currentHash = await hashUserData(user);
        if (currentHash !== savedHash) {
            alert('Не бъди злонамерен <3 ');
            localStorage.clear();
            window.location.href = 'Index.html';
            return;
        }
    } catch (error) {
        console.error('Грешка при проверка на хеша:', error);
        alert('Възникна грешка. Пренасочване към началната страница.');
        window.location.href = 'Index.html';
        return;
    }
    
    if (user) {
        document.getElementById('first-name').textContent = user.firstName || 'Няма данни';
        document.getElementById('last-name').textContent = user.lastName || 'Няма данни';
        document.getElementById('age').textContent = user.age || 'Няма данни';

        // Показване или скриване на бутона за треньор в зависимост от roleID
        if (user.roleID === 2) {
            const coachButton = document.getElementById('coach-button');
            coachButton.classList.remove('hidden');

            // Добавяне на обработчик на събитието за бутона на треньора
            coachButton.addEventListener('click', function () {
                window.location.href = 'CoacherPage.html'; // Пренасочване към CoacherPage.html
            });
        } else {
            document.getElementById('coach-button').classList.add('hidden');
        }
        
        // Извличане на информация за клуба
        fetch(`https://sportstatsapi.azurewebsites.net/api/Clubs/${user.clubID}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(club => {
                document.getElementById('club').textContent = club.name || 'Няма данни';
                // Извличане на дисциплините на клуба
                fetchDisciplinesByClubId(user.clubID);
            })
            .catch(error => {
                console.error('Грешка при извличане на информация за клуба:', error);
                document.getElementById('club').textContent = 'Грешка при зареждане на клуба';
            });

        // Добавяне на събитие за формата за дисциплина
        document.getElementById('discipline-form').addEventListener('submit', function (event) {
            event.preventDefault();
            const disciplineId = parseInt(document.getElementById('discipline').value, 10);
            if (disciplineId) {
                fetchResults(disciplineId, user.id);
            }
        });

if (user && user.id > 0) {
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
        // Функция за извличане на общите точки на потребителя
        function fetchUserTotalPoints(userId) {
            fetch(`https://sportstatsapi.azurewebsites.net/api/Rankings/user/${userId}/total-points-and-rank`)
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(results => {
                    const totalPoints = results.reduce((sum, result) => sum + result.totalPoints, 0);
                    const mostFrequentRank = findMostFrequentRank(results);
                    document.getElementById('total-points').textContent = `Общо точки: ${totalPoints} ${mostFrequentRank}`;
                })
                .catch(error => {
                    console.error('Грешка при извличане на общите точки на потребителя:', error);
                    document.getElementById('total-points').textContent = 'Грешка при зареждане на точки';
                });
        }

        function findMostFrequentRank(results) {
            const rankCount = results.reduce((acc, result) => {
                acc[result.rankName] = (acc[result.rankName] || 0) + 1;
                return acc;
            }, {});

            return Object.keys(rankCount).reduce((a, b) => rankCount[a] > rankCount[b] ? a : b);
        }

        // Извикване на функцията с ID на потребителя
        if (user && user.id) {
            fetchUserTotalPoints(user.id);
        }
    } else {
        // Ако няма данни в localStorage, пренасочване към началната страница index.html
        window.location.href = 'index.html';
    }

    function fetchDisciplinesByClubId(clubId) {
        // Извличане на дисциплините свързани само с този клуб
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

    function populateDisciplineDropdown(disciplines) {
        const disciplineSelect = document.getElementById('discipline');
        disciplineSelect.innerHTML = '<option value="" disabled selected>Дисциплина</option>';
        disciplines.forEach(discipline => {
            const option = document.createElement('option');
            option.value = discipline.id;
            option.textContent = discipline.disciplineName || `Дисциплина ${discipline.id} (Без име)`;
            disciplineSelect.appendChild(option);
        });
    }

    function fetchResults(disciplineId, userId) {
        fetch(`https://sportstatsapi.azurewebsites.net/api/Results/by-user/${userId}/by-discipline/${disciplineId}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(results => {
                if (results.length === 0) {
                    document.getElementById('best-result').textContent = 'Няма налични резултати.';
                    document.getElementById('latest-result').textContent = 'Няма налични резултати.';
                    document.getElementById('normative-difference').textContent = '';
                    return;
                }
                // Предайте възраст и пол на функцията fetchNormativesAndDisplayResults
                fetchNormativesAndDisplayResults(disciplineId, user.age, user.gender, results);
            })
            .catch(error => {
                console.error('Грешка при извличане на резултатите:', error);
                document.getElementById('best-result').textContent = 'Грешка при извличане на резултатите.';
                document.getElementById('latest-result').textContent = 'Грешка при извличане на резултатите.';
                document.getElementById('normative-difference').textContent = '';
            });
    }

    function fetchNormativesAndDisplayResults(disciplineId, userAge, userGender, results) {
        fetch(`https://sportstatsapi.azurewebsites.net/api/Normatives/discipline/${disciplineId}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(normatives => {
                console.log('Получени нормативи:', normatives);
                const genderMapping = { 'Male': 'M', 'Female': 'F' };
                const mappedGender = genderMapping[userGender.charAt(0).toUpperCase() + userGender.slice(1)] || userGender;
                
                displayResults(disciplineId, userAge, mappedGender, results, normatives);
            })
            .catch(error => {
                console.error('Грешка при извличане на нормативите:', error);
                displayResults(disciplineId, userAge, userGender, results, []);
            });
    }
    
    function displayResults(disciplineId, userAge, userGender, results, normatives) {
        console.log('Резултати:', results);
        console.log('Нормативи:', normatives);

        const latestResult = results.reduce((latest, result) => 
            new Date(result.resultDate) > new Date(latest.resultDate) ? result : latest, results[0]
        );

        let bestResult;
        let normativeDifferenceText = '';
        let normativeValueText = '';
        let normativeStatusText = '';
        let relevantNormatives = []; // Declare relevantNormatives here

        const timeDisciplines = Array.from({ length: 18 }, (_, i) => i + 1); // Нов списък на времеви дисциплини
        const isTimeDiscipline = timeDisciplines.includes(disciplineId); // Проверка дали е времева дисциплина


        // Function for finding the best result based on discipline type
        function findBestResult(results, isTimeDiscipline) {
            return results.reduce((best, result) => {
                if (isTimeDiscipline) {
                    return result.valueTime < best.valueTime ? result : best;
                } else {
                    return result.valueTime > best.valueTime ? result : best;
                }
            }, results[0]);
        }

        // Function for finding normatives based on swimmingPoolStandartId
        function findNormatives(normatives, disciplineId, userAge, userGender) {
            const genderMapping = { 'Male': 'M', 'Female': 'F' }; // Дефинираме genderMapping тук
            const mappedGender = genderMapping[userGender] || userGender;
        
            return normatives.filter(n => 
                userAge >= n.minAge && userAge <= n.maxAge && 
                n.gender === mappedGender && n.disciplineId === disciplineId
            );
        }
    
        bestResult = findBestResult(results, isTimeDiscipline);

        if (normatives.length > 0) {
            console.log('Търсене на нормативи за:', { userAge, userGender, disciplineId });
            relevantNormatives = findNormatives(normatives, disciplineId, userAge, userGender);
        
            if (relevantNormatives.length > 0) {
                relevantNormatives.forEach(normative => {
                    const poolType = normative.swimmingPoolStandartId === 1 ? '25m' : '50m';
                    const normativeValue = normative.valueStandart;
                    const difference = isTimeDiscipline ? bestResult.valueTime - normativeValue : normativeValue - bestResult.valueTime;
        
                    normativeValueText += `Норматив (${poolType}): ${formatTime(normativeValue)}<br>`;
                    normativeDifferenceText += `Разлика с норматив (${poolType}): ${difference.toFixed(2)} сек<br>`;
        
                    const statusColor = difference <= 0 ? '#93ed87' : '#fa8787'; 
                    normativeStatusText += `
                        <div style="display: inline-block; width: 80px; height: 40px; background-color: ${statusColor}; 
                        color: black; text-align: center; line-height: 40px; border-radius: 5px;margin-right: -3px;; font-weight: bold;margin-left: 14px;">
                            ${poolType}
                        </div><br>`;
                });
            } else {
                normativeValueText = 'Няма норматив за тази възрастова група и дисциплина.';
            }
        } else {
            normativeValueText = 'Няма налични нормативи.';
        }
        
        
        const chartLabels = results.map(result => new Date(result.resultDate).toLocaleDateString());
        const chartData = results.map(result => result.valueTime);

        let normative25m = null, normative50m = null;
        let chartNormative25m = [], chartNormative50m = [];

        relevantNormatives.forEach(normative => {
            if (normative.swimmingPoolStandartId === 1) {
                normative25m = normative.valueStandart;
            } else if (normative.swimmingPoolStandartId === 2) {
                normative50m = normative.valueStandart;
            }
        });

        chartNormative25m = chartLabels.map(() => normative25m ? normative25m : null);
        chartNormative50m = chartLabels.map(() => normative50m ? normative50m : null);        
        
        const ctx = document.getElementById('resultsChart')?.getContext('2d');
if (ctx) {
    if (chart) {
        chart.destroy();
    }

    // Ограничаваме данните до последните 8 елемента
const latestDataCount = 8;

const latestLabels = chartLabels.slice(-latestDataCount);
const latestChartData = chartData.slice(-latestDataCount);
const latestChartNormative25m = chartNormative25m.slice(-latestDataCount);
const latestChartNormative50m = chartNormative50m.slice(-latestDataCount);

// Създаване на градиенти
const gradientLine1 = ctx.createLinearGradient(0, 0, 0, 400);
gradientLine1.addColorStop(0, 'rgba(75, 192, 192, 0.8)');
gradientLine1.addColorStop(1, 'rgba(75, 192, 192, 0.4)');

const gradientLine2 = ctx.createLinearGradient(0, 0, 0, 400);
gradientLine2.addColorStop(0, 'rgba(255, 99, 132, 0.8)');
gradientLine2.addColorStop(1, 'rgba(255, 99, 132, 0.4)');

const gradientLine3 = ctx.createLinearGradient(0, 0, 0, 400);
gradientLine3.addColorStop(0, 'rgba(54, 162, 235, 0.8)');
gradientLine3.addColorStop(1, 'rgba(54, 162, 235, 0.4)');

// Създаване на графиката с последните 8 резултата
chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: latestLabels, // Използваме само последните 8 етикета
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
                pointStyle: 'rectRounded', // по-забавни точки
            },
            {
                label: 'Норматив 25m',
                data: latestChartNormative25m,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: gradientLine2,
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHoverRadius: 8,
                pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                pointHoverBackgroundColor: 'rgba(255, 99, 132, 0.8)',
            },
            {
                label: 'Норматив 50m',
                data: latestChartNormative50m,
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: gradientLine3,
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHoverRadius: 8,
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                pointHoverBackgroundColor: 'rgba(54, 162, 235, 0.8)',
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'nearest',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: {
                        family: 'Arial',
                        size: 14,
                        weight: 'normal',
                    },
                    padding: 20,
                    boxWidth: 20
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: {
                    weight: 'bold',
                    size: 14
                },
                bodyFont: {
                    size: 12
                },
                callbacks: {
                    label: function(context) {
                        const value = context.parsed.y;
                        if (context.dataset.label.includes("Норматив")) {
                            return `Норматив: ${value}`;
                        } else {
                            return isTimeDiscipline ? `Резултат: ${formatTime(value)}` : `Резултат: ${value}`;
                        }
                    }
                }
            }
        },
        scales: {
            x: {
                display: false, // Скриване на етикетите по x-оста
                title: {
                    display: true,
                    text: 'Дата',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    lineWidth: 1
                }
            },
            y: {
                title: {
                    display: true,
                    text: getUnitForDiscipline(disciplineId),
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                    lineWidth: 1
                },
                beginAtZero: !isTimeDiscipline,
                reverse: isTimeDiscipline,
                ticks: {
                    stepSize: 0.10,  // Увеличете стъпката за да разширите разстоянията
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
     
        
        document.getElementById('best-result').textContent = bestResult 
            ? `Най-добър резултат: ${formatTime(bestResult.valueTime)}` 
            : 'Няма налични резултати.';
        
        document.getElementById('latest-result').textContent = latestResult 
            ? `Последен резултат: ${formatTime(latestResult.valueTime)}` 
            : 'Няма налични резултати.';
        
        document.getElementById('normative-difference').innerHTML = normativeDifferenceText;
        
        document.getElementById('normative-value').innerHTML = normativeValueText + 
            (normativeStatusText ? normativeStatusText : '');
    }    
    // Функция за форматиране на време
    function formatTime(seconds) {
        if (seconds === undefined || seconds === null || isNaN(seconds)) {
            return 'Неизвестна стойност';
        }

        if (seconds < 1) {
            const millis = Math.round(seconds * 100);
            return `${millis} ст`;
        }

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const millis = Math.round((seconds % 1) * 100);

        let timeString = '';
        if (hours > 0) timeString += `${hours} ч `;
        if (minutes > 0 || hours > 0) timeString += `${minutes} мин `;
        if (secs > 0 || minutes > 0 || hours > 0) timeString += `${secs} сек `;
        if (millis > 0 || (seconds % 1 !== 0)) timeString += `${millis} ст`;

        return timeString.trim();
    }

    function getUnitForDiscipline(disciplineId) {
        // Определяне на единицата за дисциплината
        if ([1, ...Array.from({ length: 20 }, (_, i) => i + 44)].includes(disciplineId)) {
            return 'време';
        } else if ([2, ...Array.from({ length: 6 }, (_, i) => i + 33)].includes(disciplineId)) {
            return 'метра';
        } else {
            return '';
        }
    }
});

