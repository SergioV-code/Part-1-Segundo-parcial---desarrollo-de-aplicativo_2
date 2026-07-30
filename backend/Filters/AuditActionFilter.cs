using System.Security.Claims;
using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EDUMETRICS_DR.Filters;

public class AuditActionFilter : IAsyncActionFilter
{
    private readonly IAuditService _auditService;

    public AuditActionFilter(IAuditService auditService)
    {
        _auditService = auditService;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var executed = await next();
        var metadata = context.ActionDescriptor.EndpointMetadata.OfType<AuditActionAttribute>().FirstOrDefault();
        if (metadata is null)
        {
            return;
        }

        if (executed.Exception is not null)
        {
            return;
        }

        var statusCode = executed.Result switch
        {
            ObjectResult o => o.StatusCode ?? 200,
            StatusCodeResult s => s.StatusCode,
            EmptyResult => 200,
            _ => 200
        };

        if (statusCode < 200 || statusCode >= 300)
        {
            return;
        }

        var user = context.HttpContext.User;
        var usuario = user.FindFirstValue("email")
                  ?? user.FindFirstValue(ClaimTypes.Email)
                  ?? user.Identity?.Name
                  ?? user.FindFirstValue(ClaimTypes.Name)
                      ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? "anonimo";

        var rol = user.FindFirstValue(ClaimTypes.Role) ?? "sin-rol";

        var details = $"{context.HttpContext.Request.Method} {context.HttpContext.Request.Path} | Query: {context.HttpContext.Request.QueryString}";

        try
        {
            await _auditService.LogAsync(usuario, rol, metadata.ActionName, details, context.HttpContext.RequestAborted);
        }
        catch
        {
            // No bloquear la respuesta principal si la auditoría falla por una caída temporal de la base de datos.
        }
    }
}
