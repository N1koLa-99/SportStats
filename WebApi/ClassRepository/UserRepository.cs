using SpoerStats2.Models;
using Dapper;
using System.Data.SqlClient;
using System.Threading.Tasks;
using SpoerStats2.Repository;
using Microsoft.AspNetCore.Identity;

namespace SpoerStats2.ClassRepository
{
    public class UserRepository : IUserRepository
    {
        private readonly string _connectionString;

        public UserRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task<bool> DoesEmailExist(string email)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "SELECT COUNT(1) FROM Users WHERE Email = @Email";
                var count = await connection.ExecuteScalarAsync<int>(query, new { Email = email });
                return count > 0;
            }
        }
        public async Task<IEnumerable<User>> GetAllUsers()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<User>("SELECT * FROM Users");
            }
        }

        public async Task<User> GetUserById(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<User>("SELECT * FROM Users WHERE Id = @Id", new { Id = id });
            }
        }

        public async Task<User> GetUserByEmail(string email)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "SELECT * FROM Users WHERE Email = @Email";
                return await connection.QuerySingleOrDefaultAsync<User>(query, new { Email = email });
            }
        }
        public async Task AddUser(User user)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "INSERT INTO Users (FirstName, LastName, Email, Password, Gender, RoleID, ClubID, profileImage_url, YearOfBirth) " +
                            "OUTPUT INSERTED.Id " + // Връща ID на новия запис
                            "VALUES (@FirstName, @LastName, @Email, @Password, @Gender, @RoleID, @ClubID, @profileImage_url, @YearOfBirth)";

                // Задаваме генерираното ID на потребителя
                user.Id = await connection.QuerySingleAsync<int>(query, new
                {
                    user.FirstName,
                    user.LastName,
                    user.Email,
                    user.Password,
                    user.Gender,
                    user.RoleID,
                    user.ClubID,
                    user.profileImage_url,
                    user.YearOfBirth
                });
            }
        }

        public async Task UpdateUser(User user)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Users SET FirstName = @FirstName, LastName = @LastName,Email = @Email, " +
                            "Gender = @Gender, profileImage_url = @profileImage_url, Password = @Password, YearOfBirth = @YearOfBirth " +
                            "WHERE Id = @Id";

                var parameters = new DynamicParameters();
                parameters.Add("FirstName", user.FirstName);
                parameters.Add("LastName", user.LastName);
                parameters.Add("Email", user.Email);
                parameters.Add("Gender", user.Gender);
                parameters.Add("profileImage_url", user.profileImage_url);
                parameters.Add("Password", user.Password);
                parameters.Add("YearOfBirth", user.YearOfBirth);
                parameters.Add("Id", user.Id);

                await connection.ExecuteAsync(query, parameters);
            }
        }

        public async Task DeleteUser(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "DELETE FROM Users WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Id = id });
            }
        }
        public async Task<User> GetUserByEmailAndPassword(string email, string password)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "SELECT * FROM Users WHERE Email = @Email";
                var user = await connection.QuerySingleOrDefaultAsync<User>(query, new { Email = email });

                if (user == null)
                {
                    return null;
                }

                var passwordHasher = new PasswordHasher<User>();
                var result = passwordHasher.VerifyHashedPassword(user, user.Password, password);
                return result == PasswordVerificationResult.Success ? user : null;
            }
        }

        public async Task<IEnumerable<User>> GetUsersByClubId(int clubId)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "SELECT * FROM Users WHERE ClubID = @ClubID";
                return await connection.QueryAsync<User>(query, new { ClubID = clubId });
            }
        }
        public async Task UpdateFirstName(int id, string firstName)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Users SET FirstName = @FirstName WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { FirstName = firstName, Id = id });
            }
        }

        public async Task UpdateLastName(int id, string lastName)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Users SET LastName = @LastName WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { LastName = lastName, Id = id });
            }
        }
        public async Task UpdateYearOfBirth(int id, int yearOfBirth)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Users SET YearOfBirth = @YearOfBirth WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { YearOfBirth = yearOfBirth, Id = id });
            }
        }

        public async Task UpdateEmail(int id, string email)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Users SET Email = @Email WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Email = email, Id = id });
            }
        }

        public async Task UpdatePassword(int id, string password)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Users SET Password = @Password WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Password = password, Id = id });
            }
        }
        public async Task<IEnumerable<User>> SearchUsersByName(string query)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var sqlQuery = "SELECT * FROM Users WHERE FirstName LIKE @Query OR LastName LIKE @Query";
                return await connection.QueryAsync<User>(sqlQuery, new { Query = $"%{query}%" });
            }
        }


    }
}
