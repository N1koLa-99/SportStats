using Microsoft.AspNetCore.Mvc;
using SpoerStats2.Models;

namespace SpoerStats2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ResultsController : ControllerBase
    {
        private readonly ResultService _resultService;

        public ResultsController(ResultService resultService)
        {
            _resultService = resultService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Result>>> GetResults()
        {
            try
            {
                var results = await _resultService.GetAllResults();
                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Result>> GetResult(int id)
        {
            try
            {
                var result = await _resultService.GetResultById(id);
                if (result == null) return NotFound();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost]
        public async Task<ActionResult<Result>> PostResult(Result result)
        {
            try
            {
                await _resultService.AddResult(result);
                return CreatedAtAction("GetResult", new { id = result.Id }, result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutResult(int id, Result result)
        {
            if (id != result.Id) return BadRequest();

            try
            {
                await _resultService.UpdateResult(result);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteResult(int id)
        {
            try
            {
                var result = await _resultService.GetResultById(id);
                if (result == null) return NotFound();
                await _resultService.DeleteResult(id);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }
        [HttpGet("by-user/{userId}/by-discipline/{disciplineId}")]
        public async Task<ActionResult<IEnumerable<Result>>> GetResultsByUserIdAndDisciplineId(int userId, int disciplineId)
        {
            try
            {
                var results = await _resultService.GetResultsByUserId(userId);

                var filteredResults = results.Where(r => r.DisciplineId == disciplineId).ToList();

                if (filteredResults == null || !filteredResults.Any())
                {
                    return NotFound("Няма резултати за този потребител и дисциплина.");
                }

                return Ok(filteredResults);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }
    }
}
