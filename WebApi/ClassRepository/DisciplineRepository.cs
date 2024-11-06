using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Data.SqlClient;
using Dapper;

namespace SpoerStats2.ClassRepository
{
    public class DisciplineRepository : IDisciplineRepository
    {
        private readonly string _connectionString;

        public DisciplineRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task<IEnumerable<Discipline>> GetAllDisciplines()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Discipline>("SELECT * FROM Disciplines");
            }
        }

        public async Task<Discipline> GetDisciplineById(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<Discipline>("SELECT * FROM Disciplines WHERE Id = @Id", new { Id = id });
            }
        }

        public async Task<IEnumerable<Discipline>> GetDisciplinesBySportId(int sportId)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Discipline>("SELECT * FROM Disciplines WHERE SportId = @SportId", new { SportId = sportId });
            }
        }

        public async Task AddDiscipline(Discipline discipline)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "INSERT INTO Disciplines (DisciplineName, SportId) VALUES (@DisciplineName, @SportId)";
                await connection.ExecuteAsync(query, discipline);
            }
        }

        public async Task UpdateDiscipline(Discipline discipline)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Disciplines SET DisciplineName = @DisciplineName, SportId = @SportId WHERE Id = @Id";
                await connection.ExecuteAsync(query, discipline);
            }
        }

        public async Task DeleteDiscipline(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "DELETE FROM Disciplines WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Id = id });
            }
        }
        public async Task<IEnumerable<Discipline>> GetDisciplinesByIds(IEnumerable<int> ids)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "SELECT * FROM Disciplines WHERE Id IN @Ids";
                return await connection.QueryAsync<Discipline>(query, new { Ids = ids });
            }
        }

    }

}
