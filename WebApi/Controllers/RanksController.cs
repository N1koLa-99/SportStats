using Microsoft.AspNetCore.Mvc;
using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SpoerStats2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RanksController : ControllerBase
    {
        private readonly IRankRepository _rankRepository;

        public RanksController(IRankRepository rankRepository)
        {
            _rankRepository = rankRepository;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Rank>>> GetRanks()
        {
            return Ok(await _rankRepository.GetAllRanks());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Rank>> GetRank(int id)
        {
            var rank = await _rankRepository.GetRankById(id);
            if (rank == null) return NotFound();
            return Ok(rank);
        }

        [HttpPost]
        public async Task<ActionResult<Rank>> PostRank(Rank rank)
        {
            await _rankRepository.AddRank(rank);
            return CreatedAtAction("GetRank", new { id = rank.Id }, rank);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutRank(int id, Rank rank)
        {
            if (id != rank.Id) return BadRequest();
            await _rankRepository.UpdateRank(rank);
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRank(int id)
        {
            var rank = await _rankRepository.GetRankById(id);
            if (rank == null) return NotFound();
            await _rankRepository.DeleteRank(id);
            return NoContent();
        }
    }
}
