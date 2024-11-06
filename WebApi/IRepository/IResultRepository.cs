using SpoerStats2.Models;

namespace SpoerStats2.Repository
{
    public interface IResultRepository
    {
        Task<IEnumerable<Result>> GetAllResults();
        Task<Result> GetResultById(int id);
        Task<IEnumerable<Result>> GetResultsByUserId(int userId);
        Task AddResult(Result result);
        Task UpdateResult(Result result);
        Task DeleteResult(int id);

    }

}
