using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Data.SqlClient;
using Dapper;

namespace SpoerStats2.ClassRepository
{
    public class ResultRepository : IResultRepository
    {
        private readonly string _connectionString;

        public ResultRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task<IEnumerable<Result>> GetAllResults()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Result>("SELECT * FROM Results");
            }
        }

        public async Task<Result> GetResultById(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<Result>("SELECT * FROM Results WHERE Id = @Id", new { Id = id });
            }
        }

        public async Task<IEnumerable<Result>> GetResultsByUserId(int userId)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Result>("SELECT * FROM Results WHERE UserId = @UserId", new { UserId = userId });
            }
        }

        public async Task AddResult(Result result)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "INSERT INTO Results (UserId, DisciplineId, ValueTime, ResultDate) VALUES (@UserId, @DisciplineId, @ValueTime, @ResultDate)";
                await connection.ExecuteAsync(query, result);
            }
        }

        public async Task UpdateResult(Result result)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Results SET UserId = @UserId, DisciplineId = @DisciplineId, ValueTime = @ValueTime, ResultDate = @ResultDate WHERE Id = @Id";
                await connection.ExecuteAsync(query, result);
            }
        }

        public async Task DeleteResult(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "DELETE FROM Results WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Id = id });
            }
        }
    }

}
