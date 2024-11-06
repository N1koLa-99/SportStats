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
                // В методите AddUser и UpdateUser използвайте един и същ код за хеширане:
                var passwordHasher = new PasswordHasher<User>();
                user.Password = passwordHasher.HashPassword(user, user.Password);


                var query = "INSERT INTO Users (FirstName, LastName, Age, Email, Password, Gender, RoleID, ClubID, profileImage_url) " +
                            "VALUES (@FirstName, @LastName, @Age, @Email, @Password, @Gender, @RoleID, @ClubID, @profileImage_url)";
                await connection.ExecuteAsync(query, new
                {
                    user.FirstName,
                    user.LastName,
                    user.Age,
                    user.Email,
                    user.Password,
                    user.Gender,
                    user.RoleID,
                    user.ClubID,
                    user.profileImage_url
                });
            }
        }

        public async Task UpdateUser(User user)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var existingUser = await connection.QuerySingleOrDefaultAsync<User>("SELECT * FROM Users WHERE Id = @Id", new { Id = user.Id });
                if (existingUser == null)
                {
                    throw new ArgumentException("User not found.");
                }

                // Ако паролата е предоставена, хешираме я
                if (!string.IsNullOrWhiteSpace(user.Password))
                {
                    // В методите AddUser и UpdateUser използвайте един и същ код за хеширане:
                    var passwordHasher = new PasswordHasher<User>();
                    user.Password = passwordHasher.HashPassword(user, user.Password);

                }
                else
                {
                    // Ако паролата не е предоставена, оставяме същата парола (не променяме хеша)
                    user.Password = existingUser.Password;
                }

                var query = "UPDATE Users SET FirstName = @FirstName, LastName = @LastName, Age = @Age, Email = @Email, " +
                            "Gender = @Gender, profileImage_url = @profileImage_url, Password = @Password WHERE Id = @Id";

                var parameters = new DynamicParameters();
                parameters.Add("FirstName", user.FirstName);
                parameters.Add("LastName", user.LastName);
                parameters.Add("Age", user.Age);
                parameters.Add("Email", user.Email);
                parameters.Add("Gender", user.Gender);
                parameters.Add("profileImage_url", user.profileImage_url);
                parameters.Add("Password", user.Password); // Записваме хешираната парола
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
    }
}
