document.addEventListener('DOMContentLoaded', async function () {
    const user = JSON.parse(localStorage.getItem('user'));
    console.log('User:', user);
    
    async function fetchJson(url) {
        try {
            const response = await fetch(url);
    
            if (!response.ok) {
                throw new Error(`HTTP Error ${response.status} (${response.statusText})`);
            }
    
            return await response.json();
        } catch (error) {
            console.error(`Грешка при заявката: ${url}`, error);
            throw error; 
        }
    }
    
    async function deleteResult(resultId) {
        const confirmation = prompt('Сигурни ли сте, че искате да изтриете резултата? Напишете 1 за потвърждение.');
        if (confirmation !== '1') {
            showMessageBox('Изтриването е отменено.');
            return; 
        }
    
        try {
            const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Results/${resultId}?requesterId=${user.id}&roleId=${user.roleID}&clubId=${user.clubID}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
    
            if (!response.ok) {
                throw new Error('Неуспешно изтриване на резултата');
            }
    
            showMessageBox('Резултатът е изтрит успешно!');
            const disciplineId = Number(document.getElementById('discipline').value);
            const clubUsers = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`);
            const results = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Results?requesterId=${user.id}`);
            displayUsersTable(clubUsers, results, disciplineId);
        } catch (error) {
            showMessageBox('Грешка при изтриване на резултата.', true);
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
                ? results.filter(result => result.userId === user.id && result.disciplineId == disciplineId) // == за сравнение с string/number
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
    
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.firstName}</td>
                <td>${user.lastName}</td>
                <td>${user.yearOfBirth ? user.yearOfBirth : 'Няма данни'}</td>
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
            showMessageBox('Няма достъп до тази страница.', true);
            window.location.href = 'HomePage.html';
            return;
        }
    
        document.getElementById('coach-name').textContent = `${user.firstName} ${user.lastName}`;
    
        try {
            const disciplines = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/ClubDisciplines/disciplines-by-club/${user.clubID}`);
            populateDropdown('discipline', disciplines, 'disciplineName', 'id');
    
            const clubUsers = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`);
            let results = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Results?requesterId=${user.id}`);
            console.log('Резултати за потребителя:', results);
    
            displayUsersTable(clubUsers, results, null);
    
            document.getElementById('discipline').addEventListener('change', function () {
                const disciplineId = parseInt(this.value, 10); // Преобразуваме към число
                console.log('Discipline changed to:', disciplineId);
    
                displayUsersTable(clubUsers, results, disciplineId); // Правилно подаваме disciplineId
            });
    
        } catch (error) {
            showMessageBox('Не можа да се извлекат данните.', true);
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
        let millis = Math.round((seconds % 1) * 100);
    
        // Осигуряване на двуцифрен формат за милисекундите
        millis = millis < 10 ? `0${millis}` : `${millis}`;
    
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
        populateDropdown('add-user', clubUsers, user => `${user.firstName} ${user.lastName} (${user.yearOfBirth})`, 'id');
    
        document.getElementById('add-discipline').addEventListener('change', function () {
            const disciplineId = Number(this.value);
            const timeBasedIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    
            const isTimeBased = timeBasedIds.includes(disciplineId);
            document.getElementById('time-input').style.display = isTimeBased ? 'block' : 'none';
            document.getElementById('decimal-input').style.display = isTimeBased ? 'none' : 'block';
        });
    
        document.getElementById('add-user').addEventListener('change', async function () {
            const userId = this.value;
            const userProfilePicture = document.getElementById('user-profile-picture');
        
            if (!userId) {
                userProfilePicture.style.display = 'none';
                return;
            }
        
            try {
                const [userResponse, imageResponse] = await Promise.all([
                    fetch(`https://sportstatsapi.azurewebsites.net/api/Users/${userId}`), 
                    fetch(`https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${userId}`)
                ]);
        
                if (!userResponse.ok) throw new Error('Грешка при зареждане на потребителските данни');
        
                const user = await userResponse.json();
                console.log('Избран потребител:', user);
        
                if (imageResponse.ok) {
                    const imageBlob = await imageResponse.blob();
                    userProfilePicture.src = URL.createObjectURL(imageBlob);
                } else {
                    userProfilePicture.src = '../SportStatsImg/ProfilePhoto2.jpg';
                }
        
                userProfilePicture.style.display = 'block';
            } catch (error) {
                console.error('Грешка:', error);
                userProfilePicture.src = '../SportStatsImg/ProfilePhoto2.jpg';
                userProfilePicture.style.display = 'block';
            }
        });
        
        
        
    
        document.getElementById('submit-result').addEventListener('click', async function () {
            const disciplineId = Number(document.getElementById('add-discipline').value);
            const userId = Number(document.getElementById('add-user').value);
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
    
            if (isNaN(valueTime) || valueTime < 0 || valueTime > 86400) {
                showMessageBox('Моля, въведете валиден резултат. Стойността трябва да бъде между 0 и 86400 секунди.');
                return;
            }
    
            try {
                const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Results?requesterId=${user.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                    throw new Error('Неуспешно добавяне на резултата.');
                }
    
                showMessageBox('Резултатът е добавен успешно!');
    
                try {
                    const isQualified = await compareResultWithNorms(userId, disciplineId, valueTime);
    
                    if (isQualified) {
                        const points = 50;
                        await addPointsToRankings(userId, disciplineId, points);
                    }
                } catch (comparisonError) {
                    console.warn('Грешка при проверка на норматива или добавяне на точки:', comparisonError);
                }
    
            } catch (error) {
                console.error('Грешка:', error);
                showMessageBox('Грешка при добавяне на резултата.', true);
            }
        });
    
        populateRoller('hours', 0, 23);
        populateRoller('minutes', 0, 59);
        populateRoller('seconds', 0, 59);
        populateRoller('milliseconds', 0, 99);
    }
    
    
    
    function populateRoller(id, start, end) {
        const select = document.getElementById(id);
        for (let i = start; i <= end; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i.toString().padStart(2, '0');
            select.appendChild(option);
        }
    }

    function showMessageBox(message, isNegative = false) {
        const messageBox = document.getElementById('message-box');
        const messageText = document.getElementById('message-box-text');
        const progressBar = document.getElementById('message-box-progress-bar');
        
        // Set the message text
        messageText.textContent = message;
        
        // Show the message box with animation
        messageBox.style.display = 'flex';
        
        // Set the progress bar to 0% initially
        progressBar.style.width = '0%';
        
        // Start the progress bar animation
        setTimeout(() => {
            progressBar.style.width = '100%';
        }, 50);
        
        // Automatically close the message box after the progress bar completes (2 seconds)
        setTimeout(() => {
            messageBox.style.opacity = '0';  // Fading out
            messageBox.style.transform = 'translateY(-20px)';
        }, 3000); // 2 seconds for message duration (progress bar time)
        
        // Hide the message box after the animation completes
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 3200); // Hides the message box 200ms after the fade-out
    }
    
    
    
    document.getElementById('go-home').addEventListener('click', function () {
        window.location.href = 'HomePage.html';
    });

    await setupAddResultForm();
    await handleCoach();
});