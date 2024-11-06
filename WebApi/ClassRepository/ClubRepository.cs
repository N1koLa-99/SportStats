using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Data.SqlClient;
using Dapper;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;

namespace SpoerStats2.ClassRepository
{
    public class ClubRepository : IClubRepository
    {
        private readonly string _connectionString;

        public ClubRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task<IEnumerable<Club>> GetAllClubs()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Club>("SELECT * FROM Clubs");
            }
        }

        public async Task<Club> GetClubById(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<Club>("SELECT * FROM Clubs WHERE Id = @Id", new { Id = id });
            }
        }

        public async Task AddClub(Club club)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "INSERT INTO Clubs (Name, Location, Address) VALUES (@Name, @Location, @Address)";
                await connection.ExecuteAsync(query, club);
            }
        }

        public async Task UpdateClub(Club club)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Clubs SET Name = @Name, Location = @Location, Address = @Address WHERE Id = @Id";
                await connection.ExecuteAsync(query, club);
            }
        }

        public async Task DeleteClub(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "DELETE FROM Clubs WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Id = id });
            }
        }
    }
}
