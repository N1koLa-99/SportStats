document.addEventListener('DOMContentLoaded', async function () {
    const user = JSON.parse(localStorage.getItem('user'));
    console.log('User:', user);
    
    async function fetchJson(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            console.log('Fetched data from', url, ':', data);
            return data;
        } catch (error) {
            console.error('Грешка при извличане на данни:', error);
            throw error;
        }
    }
    async function deleteResult(resultId) {
        const confirmation = prompt('Сигурни ли сте, че искате да изтриете резултата? Напишете 1 за потвърждение.');
        if (confirmation !== '1') {
            alert('Изтриването е отменено.');
            return; 
        }
    
        try {
            const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Results/${resultId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error('Неуспешно изтриване на резултата');
            }
    
            alert('Резултатът е изтрит успешно!');
            const disciplineId = Number(document.getElementById('discipline').value);
            const clubUsers = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`);
            const results = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Results`);
            displayUsersTable(clubUsers, results, disciplineId);
        } catch (error) {
            alert('Грешка при изтриване на резултата.');
            console.error('Грешка:', error);
        }
    }
    

    function populateDropdown(elementId, items, textProperty, valueProperty) {
        const select = document.getElementById(elementId);
        if (select) {
            select.innerHTML = '<option value="" disabled selected>Изберете опция</option>';
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item[valueProperty];
                option.textContent = typeof textProperty === 'function' ? textProperty(item) : item[textProperty] || `Опция ${item[valueProperty]}`;
                select.appendChild(option);
            });
            console.log('Populated dropdown with ID:', elementId);
        }
    }

    function displayUsersTable(users, results, disciplineId = null) {
        const usersTable = document.getElementById('users-table');
        const tbody = usersTable.querySelector('tbody');
        tbody.innerHTML = '';
        console.log('Показване на таблицата с потребители с ID на дисциплината:', disciplineId);
    
        users.forEach(user => {
            const userResults = disciplineId 
                ? results.filter(result => result.userId === user.id && result.disciplineId == disciplineId)
                : [];
            
            console.log('Потребител:', user.firstName, user.lastName, 'Резултати:', userResults);
            
            const bestResult = userResults.length > 0
                ? getBestResult(userResults, disciplineId)
                : 'Няма резултат';
    
            const resultEntries = userResults
                .map(result => `
                    <tr>
                        <td>${formatResult(result.valueTime, disciplineId)}</td>
                        <td>${new Date(result.resultDate).toLocaleDateString()}</td>
                        <td>
                            <button class="delete-result" data-result-id="${result.id}" title="Изтрий">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>`)
                .join('');
    
            // Промяна на реда за yearOfBirth вместо age
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.firstName}</td>
                <td>${user.lastName}</td>
                <td>${user.yearOfBirth ? user.yearOfBirth : 'Няма данни'}</td> <!-- Заменено с година на раждане -->
                <td>${disciplineId ? bestResult : ''}</td>
                <td>
                    <table>
                        <tbody>
                            ${resultEntries || (disciplineId ? '<tr><td colspan="3">Няма резултати</td></tr>' : '')}
                        </tbody>
                    </table>
                </td>
            `;
            tbody.appendChild(row);
        });
    
        document.querySelectorAll('.delete-result').forEach(button => {
            button.addEventListener('click', async function () {
                const resultId = this.getAttribute('data-result-id');
                await deleteResult(resultId);
            });
        });
    }
    
    
    
    
    async function handleCoach() {
        if (!user || user.roleID !== 2) {
            alert('Няма достъп до тази страница.');
            window.location.href = 'HomePage.html';
            return;
        }
    
        document.getElementById('coach-name').textContent = `${user.firstName} ${user.lastName}`;
    
        try {
            const disciplines = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/ClubDisciplines/disciplines-by-club/${user.clubID}`);
            populateDropdown('discipline', disciplines, 'disciplineName', 'id');
    
            const clubUsers = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`);
            let results = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Results`);
    
            displayUsersTable(clubUsers, results);
    
            document.getElementById('discipline').addEventListener('change', function () {
                const disciplineId = Number(this.value);
                console.log('Discipline changed to:', disciplineId);
                const filteredResults = results.filter(result => result.disciplineId === disciplineId);
                displayUsersTable(clubUsers, filteredResults, disciplineId);
            });
    
            document.getElementById('add-user').addEventListener('change', function () {
                const userId = this.value;
                const userProfilePicture = document.getElementById('user-profile-picture');
                
                if (!userId) {
                    userProfilePicture.style.display = 'none'; 
                    return;
                }
        
                Promise.all([
                    fetch(`https://sportstatsapi.azurewebsites.net/api/Users/${userId}`), 
                    fetch(`https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${userId}`)
                ])
                .then(responses => {
                    if (!responses[0].ok) throw new Error('Неуспешно зареждане на данни за потребителя');
                    if (!responses[1].ok) throw new Error('Неуспешно зареждане на профилната снимка');
                    
                    return Promise.all([responses[0].json(), responses[1].blob()]);
                })
                .then(([user, imageBlob]) => {
                    console.log('Избран потребител:', user);
                    console.log('Възраст:', user.age);
                    console.log('Пол:', user.gender);
                    
                    const imageUrl = URL.createObjectURL(imageBlob);
                    userProfilePicture.src = imageUrl;
                    userProfilePicture.style.display = 'block';
                    userProfilePicture.alt = 'Профилна снимка на избрания потребител';
                })
                .catch(error => {
                    console.error('Грешка:', error);
                    userProfilePicture.src = '../SportStatsImg/ProfilePhoto2.jpg';
                    userProfilePicture.alt = 'Профилната снимка не е налична';
                    userProfilePicture.style.display = 'block';
                });
            });
            
            let searchTimeout;
            document.getElementById('search').addEventListener('keyup', function () {
                clearTimeout(searchTimeout);
        
                searchTimeout = setTimeout(() => {
                    document.getElementById('search').dispatchEvent(new Event('submit'));
                }, 1000); // 
            });
        
            document.getElementById('search').addEventListener('submit', async function (event) {
                event.preventDefault();
        
                const query = document.getElementById('search').value.trim();
                if (!query) {
                    alert('Моля, въведете име или част от име за търсене.');
                    return;
                }

                try {
                    const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/search?query=${encodeURIComponent(query)}`);
        
                    if (!response.ok) {
                        if (response.status === 404) {
                            alert('Не бяха намерени потребители, отговарящи на заявката.');
                            return;
                        }
                        throw new Error(`Грешка при търсенето: ${response.statusText}`);
                    }
        
                    const users = await response.json();
        
                    console.log('Намерени потребители:', users);
        
                    const disciplineId = Number(document.getElementById('discipline').value);
                    const allResults = await fetchJson('https://sportstatsapi.azurewebsites.net/api/Results');
                    displayUsersTable(users, allResults, disciplineId);
        
                } catch (error) {
                    console.error('Грешка при търсенето:', error);
                    alert('Възникна грешка при извършване на търсенето.');
                }
            });

            
    
        } catch (error) {
            alert('Не можа да се извлекат данните.');
            console.error('Грешка при извличане на данни:', error);
        }
    }    

    function getBestResult(results, disciplineId) {
        const timeBasedIds = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
        ];
        
        console.log('Discipline ID:', disciplineId);
        console.log('Time-based IDs:', timeBasedIds);
        
        const isTimeBased = timeBasedIds.includes(Number(disciplineId));
        
        console.log('Is time-based:', isTimeBased);
        
        let bestResult;
        if (isTimeBased) {
            bestResult = results.reduce((best, result) => {
                return result.valueTime < best.valueTime ? result : best;
            }, results[0]);
        } else {
            bestResult = results.reduce((best, result) => {
                return result.valueTime > best.valueTime ? result : best;
            }, results[0]);
        }
        
        return formatResult(bestResult.valueTime, disciplineId);
    }
    
    function formatResult(valueTime, disciplineId) {
        const timeBasedIds = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
        ];
        
        console.log('Formatting result for discipline ID:', disciplineId);

        if (typeof valueTime !== 'number' || isNaN(valueTime)) {
            return 'Неизвестна стойност';
        }

        if (timeBasedIds.includes(Number(disciplineId))) {
            const formattedTime = formatTime(valueTime);
            console.log('Formatted result (time-based):', formattedTime);
            return formattedTime;
        } else {
            const formattedNumber = valueTime.toFixed(2);
            console.log('Formatted result (number-based):', formattedNumber);
            return formattedNumber;
        }
    }
    
    function formatTime(seconds) {
        if (seconds === undefined || seconds === null || isNaN(seconds)) {
            return 'Неизвестна стойност';
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const millis = Math.round((seconds % 1) * 100);

        let timeString = '';
        if (hours > 0) timeString += `${hours} ч `;
        if (minutes > 0 || hours > 0) timeString += `${minutes} мин `;
        timeString += `${secs}.${millis} сек`;
        return timeString;
    }
    
    async function setupAddResultForm() {
        const disciplines = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/ClubDisciplines/disciplines-by-club/${user.clubID}`);
        populateDropdown('add-discipline', disciplines, 'disciplineName', 'id');
    
        const clubUsers = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`);
        // Промяна тук: показваме yearOfBirth вместо age
        populateDropdown('add-user', clubUsers, user => `${user.firstName} ${user.lastName} (${user.yearOfBirth})`, 'id');
        
        document.getElementById('add-discipline').addEventListener('change', function () {
            const disciplineId = this.value;
            const timeBasedIds = [
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
            ];
            const isTimeBased = timeBasedIds.includes(Number(disciplineId));
    
            document.getElementById('time-input').style.display = isTimeBased ? 'block' : 'none';
            document.getElementById('decimal-input').style.display = isTimeBased ? 'none' : 'block';
        });
    
        document.getElementById('submit-result').addEventListener('click', async function () {
            const disciplineId = document.getElementById('add-discipline').value;
            const userId = document.getElementById('add-user').value;
            const isTimeBased = document.getElementById('time-input').style.display === 'block';
        
            let valueTime;
            if (isTimeBased) {
                const hours = parseInt(document.getElementById('hours').value, 10) || 0;
                const minutes = parseInt(document.getElementById('minutes').value, 10) || 0;
                const seconds = parseInt(document.getElementById('seconds').value, 10) || 0;
                const milliseconds = parseInt(document.getElementById('milliseconds').value, 10) || 0;
                valueTime = hours * 3600 + minutes * 60 + seconds + milliseconds / 100;
            } else {
                valueTime = parseFloat(document.getElementById('decimal-result').value);
            }
        
            console.log('Submitting result:', { disciplineId, userId, valueTime });
        
            if (isNaN(valueTime) || valueTime === undefined) {
                alert('Моля, въведете валиден резултат.');
                return;
            }
        
            try {
                const response = await fetch('https://sportstatsapi.azurewebsites.net/api/Results', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: userId,
                        disciplineId: disciplineId,
                        valueTime: valueTime,
                        resultDate: new Date().toISOString() 
                    })
                });
        
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Failed to add result:', { status: response.status, errorText });
                    throw new Error('Неуспешно добавяне на резултата');
                }
        
                const responseData = await response.json();
                alert('Резултатът е добавен успешно!');
        
                const isQualified = await compareResultWithNorms(userId, disciplineId, valueTime);
                
                if (isQualified) {
                    const points = 50;
                    await addPointsToRankings(userId, disciplineId, points);
                }
        
            } catch (error) {
                alert('Грешка при добавяне на резултата.');
                console.error('Грешка:', error);
            }
        }); 
    }
    
    
    document.getElementById('go-home').addEventListener('click', function () {
        window.location.href = 'HomePage.html';
    });

    await setupAddResultForm();
    await handleCoach();
});
