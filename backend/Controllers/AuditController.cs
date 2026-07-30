using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.Models;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EDUMETRICS_DR.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Analista MINERD,Analista MESCYT")]
public class AuditController : ControllerBase
{
    private readonly SchoolContext _context;

    public AuditController(SchoolContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAuditLogs(CancellationToken cancellationToken)
    {
        try
        {
            var logs = await _context.AuditLogs
                .AsNoTracking()
                .OrderByDescending(l => l.FechaHora)
                .ToListAsync(cancellationToken);

            return Ok(logs);
        }
        catch (SqlException)
        {
            return Ok(Array.Empty<AuditLog>());
        }
        catch (DbUpdateException)
        {
            return Ok(Array.Empty<AuditLog>());
        }
    }
}
