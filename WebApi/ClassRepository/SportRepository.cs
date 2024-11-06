using SpoerStats2.Models;
using Dapper;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Threading.Tasks;
using SpoerStats2.IRepository;

namespace SpoerStats2.ClassRepository
{
    public class SportRepository : ISportRepository
    {
        private readonly string _connectionString;

        public SportRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task<IEnumerable<Sport>> GetAllSports()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Sport>("SELECT * FROM Sports");
            }
        }

        public async Task<Sport> GetSportById(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<Sport>("SELECT * FROM Sports WHERE Id = @Id", new { Id = id });
            }
        }

        public async Task AddSport(Sport sport)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "INSERT INTO Sports (SportName) VALUES (@SportName)";
                await connection.ExecuteAsync(query, sport);
            }
        }

        public async Task UpdateSport(Sport sport)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Sports SET SportName = @SportName WHERE Id = @Id";
                await connection.ExecuteAsync(query, sport);
            }
        }

        public async Task DeleteSport(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "DELETE FROM Sports WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Id = id });
            }
        }
    }
}
